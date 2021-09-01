/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
// LONG TERM = FLAT 10%/15%
// NET SAVINGS FOR
import express from 'express';
// import methodOverride from 'method-override';
// eslint-disable-next-line import/no-unresolved
import pg from 'pg';
import jsSHA from 'jssha';
import cookieParser from 'cookie-parser';

import dateFormat from 'dateformat';

const app = express();
const SALT = 'help';
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
// app.use(methodOverride('_method'));
app.use(cookieParser());

const { Pool } = pg;

// set the way we will connect to the server
let pgConnectionConfigs;
if (process.env.ENV === 'PRODUCTION') {
  // determine how we connect to the remote Postgres server
  pgConnectionConfigs = {
    user: 'postgres',
    // set DB_PASSWORD as an environment variable for security.
    password: process.env.DB_PASSWORD,
    host: 'localhost',
    database: 'cutdown',
    port: 5432,
  };
}
else { pgConnectionConfigs = {
  user: 'justin',
  host: 'localhost',
  database: 'cutdown',
  port: 5432, // Postgres server always runs on this port
};
}
// create the var we'll use
const pool = new Pool(pgConnectionConfigs);

const PORT = process.argv[2];

const getHash = (input) => {
  // create new SHA object
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });

  // create an unhashed cookie string based on user ID and salt
  const unhashedString = `${input}-${SALT}`;

  // generate a hashed cookie string using SHA object
  shaObj.update(unhashedString);

  return shaObj.getHash('HEX');
};

const checkAuth = (req, res, next) => {
  // set the default value
  req.isUserLoggedIn = false;

  // check to see if the cookies you need exists
  if (req.cookies.loggedIn && req.cookies.id) {
    // get the hased value that should be inside the cookie
    const hash = getHash(req.cookies.id);

    // test the value of the cookie
    if (req.cookies.loggedIn === hash) {
      req.isUserLoggedIn = true;

      // look for this user in the database
      const values = [req.cookies.id];

      // try to get the user
      pool.query('SELECT * FROM users WHERE id=$1', values, (error, result) => {
        if (error || result.rows.length < 1) {
          res.status(503).send('sorry!');
          return;
        }

        // set the user as a key in the request object so that it's accessible in the route
        req.user = result.rows[0];

        next();
      });

      // make sure we don't get down to the next() below
      return;
    }
  }

  next();
};

// if not logged in, index page is splash
const handleSplashPage = (req, res, next) => {
  if (req.isUserLoggedIn !== false) {
    res.redirect('home');
  }
  res.render('splash');
};

const handleSignUpPage = (req, res, next) => {
  res.render('register');
};

const handleSignUpPost = (req, res, next) => {
  const formData = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.emailForm,
    username: req.body.usernameForm,
    password: req.body.passwordForm,
    confirmPassword: req.body.confirmPasswordForm,
  };
  const checkEmailQuery = 'SELECT * FROM users WHERE email = $1';
  pool.query(checkEmailQuery, [formData.email], (err, result) => {
    if (result.rows.length > 0) {
      const msg = 'That email is already in use.';
      res.render('register', { alertMsg: msg });
    }
    else {
      const hashedPassword = getHash(formData.password);
      const insertQuery = 'INSERT INTO users (username, email, password, first_name, last_name) values ($1,$2,$3,$4,$5)';
      const insertData = [formData.username, formData.email, hashedPassword, formData.firstName, formData.lastName];
      console.log(insertData);
      pool.query(insertQuery, insertData, (insertErr, insertResult) => {
        if (insertErr) { throw insertErr; }
        const msg = 'You have succesfully registered!';
        res.render('login', { alertMsg: msg });
      });
    }
  });
};

// const handleSignUpPost = (req, res, next) => {
//   const formData = {
//     firstName: req.body.firstName,
//     lastName: req.body.lastName,
//     email: req.body.emailForm,
//     username: req.body.usernameForm,
//     password: req.body.passwordForm,
//     confirmPassword: req.body.confirmPasswordForm,
//   };
//   const checkEmailQuery = 'SELECT * FROM users WHERE email address = $1';
//   pool.query(checkEmailQuery, [formData.email]).then((result) => {
//     if (result.length > 0) {
//       const msg = 'That email is already in use.';
//       res.render('register', { alertMsg: msg });
//     }
//     const hashedPassword = getHash(formData.password);
//     const insertQuery = 'INSERT INTO users (username, email, password, first_name, last_name) values ($1,$2,$3,$4,$5) RETURNING *';
//     const insertData = [formData.username, formData.email, hashedPassword, formData.firstName, formData.lastName];
//     console.log(insertData);
//     pool.query (insertQuery, insertData)
//   });
//   .then ((insertResult) => {
//     const msg = 'You have succesfully registered!';
//         res.render('login', { alertMsg: msg });
//   })
//   .catch ((err) => {error.stack(err)})
// };

const handleLogInPage = (req, res) => {
  if (req.isUserLoggedIn !== false) {
    res.redirect('home');
  }
  res.render('login');
};

// const handleLogInPost = (req, res, next) => {
//   const username = req.body.loginUsername;
//   const password = req.body.loginPassword;
//   let msg = '';
//   const logInQuery = 'SELECT * FROM users WHERE username = $1';
//   pool.query(logInQuery, [username], (err, result) => {
//     if (err) { throw err; }
//     if (result.rows.length === 0) {
//       msg = 'Your username or password is incorrect';
//       res.redirect('login', { alertMsg: msg });
//     }
//     const user = result.rows[0];
//     const hashedPassword = getHash(password);
//     if (user.password !== hashedPassword) {
//       msg = 'Your username or password is incorrect';
//       res.redirect('login', { alertMsg: msg });
//     }
//     const loggedInID = user.id;
//     const loggedInHash = getHash(loggedInID);
//     res.cookie('loggedIn', loggedInHash);
//     res.cookie('id', loggedInID);
//     // IF NO DATA ABOUT USER, REDIRECT TO QUESTIONNAIRE
//     const checkQuery = 'SELECT * FROM goals WHERE users_id = $1';
//     pool.query(checkQuery, [loggedInID], (err2, result2) => {
//       if (result2.rows.length === 0) {
//         res.redirect('goalsetting');
//       }
//       // TO SELECT DATA TO RENDER IN HOME PAGE
//       res.redirect('home');
//     });
//   });
// };

// to do cookies
const handleLogInPost = (req, res) => {
  const username = req.body.loginUsername;
  const password = req.body.loginPassword;
  let msg = '';
  const logInQuery = 'SELECT * FROM users WHERE username = $1';
  pool.query(logInQuery, [username]).then((result) => {
    if (result.rows.length === 0) {
      msg = 'Your username or password is incorrect';
      res.render('login', { alertMsg: msg });
    }
    else {
      const user = result.rows[0];
      const hashedPassword = getHash(password);
      if (user.password !== hashedPassword) {
        msg = 'Your username or password is incorrect';
        res.render('login', { alertMsg: msg });
      }
      else {
        const loggedInID = user.id;
        const loggedInHash = getHash(loggedInID);
        res.cookie('loggedIn', loggedInHash);
        res.cookie('id', loggedInID);
        // IF NO DATA ABOUT USER, REDIRECT TO QUESTIONNAIRE
        const checkQuery = 'SELECT * FROM goals WHERE users_id = $1';
        pool.query(checkQuery, [loggedInID]).then((checkResult) => {
          if (checkResult.rows.length === 0) {
            res.redirect('goalsetting');
          }
          else {
            res.redirect('home');
          }
        });
      }
    }
  });
};

const handleGoalSettingPage = (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('getcutdown');
  }
  res.render('goalSetting');
};

const handleGoalSettingPost = (req, res) => {
  const formData = {
    goalName: req.body.goalName,
    goalCost: req.body.goalCost,
    mainGoal: req.body.mainGoal,
    days: Number(req.body['months-goal']) * 30,
  };
  console.log(formData);
  const insertData = [req.cookies.id, formData.goalCost, 0, formData.days, 0, req.body.date, formData.mainGoal];
  const goalInsertQuery = 'INSERT INTO goals (users_id, target_savings, current_savings, days_goal, days_current, created_at, main_goal) VALUES ($1,$2,$3,$4,$5,$6,$7)';
  pool.query(goalInsertQuery, insertData, (err, result) => {
    res.render('questionnaire');
  });
};

// if (req.body.goalTerm === 'isShortTerm') {
//   const isShortTerm = true;
// }
// else {
//   const isShortTerm = false;
// }

const handleQuestionnairePage = (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('getcutdown');
  }
  res.render('questionnaire');
};

const handleQuestionnairePost = (req, res) => {
  const monthQuery = 'SELECT days_goal, target_savings FROM goals WHERE users_id = $1';
  pool.query(monthQuery, [req.cookies.id], (err, result) => {
    const days = result.rows[0].days_goal;
    const cutdownPerMonth = Number(result.rows[0].target_savings) / (days / 30);
    const nonPriorityCutdown = cutdownPerMonth / 4;
    let priority = '';
    const cat1Data = {
      name: req.body.cat1Name,
      monthlyLimit: req.body.cat1Amt - nonPriorityCutdown,
      isPriority: false,
    };
    const cat2Data = {
      name: req.body.cat2Name,
      monthlyLimit: req.body.cat2Amt - nonPriorityCutdown,
      isPriority: false,
    };
    const cat3Data = {
      name: req.body.cat3Name,
      monthlyLimit: req.body.cat3Amt - nonPriorityCutdown,
      isPriority: false,
    };
    switch (req.body.catCheck) {
      case 'cat1Check':
        priority = 'category1';
        cat1Data.monthlyLimit -= nonPriorityCutdown;
        cat1Data.isPriority = true;
        break;
      case 'cat2Check':
        priority = 'category2';
        cat2Data.monthlyLimit -= nonPriorityCutdown;
        cat2Data.isPriority = true;
        break;
      case 'cat3Check':
        priority = 'category3';
        cat3Data.monthlyLimit -= nonPriorityCutdown;
        cat3Data.isPriority = true;
        break;
      default:
        res.send('error! Priority not found!');
    }

    const cat1DailyLimit = cat1Data.monthlyLimit / 30;
    const cat2DailyLimit = cat2Data.monthlyLimit / 30;
    const cat3DailyLimit = cat3Data.monthlyLimit / 30;
    console.log(typeof (cat1Data.monthlyLimit));
    const expenseQuery = Promise.all([
      pool.query(`INSERT INTO expense_info (users_id, daily_limit, weekly_limit, monthly_limit, is_priority, name) VALUES ('${req.cookies.id}', ${cat1DailyLimit}, ${cat1Data.monthlyLimit / 4}, ${cat1Data.monthlyLimit}, ${cat1Data.isPriority}, '${cat1Data.name}')`),
      pool.query(`INSERT INTO expense_info (users_id, daily_limit, weekly_limit, monthly_limit, is_priority, name) VALUES ('${req.cookies.id}', ${cat2DailyLimit}, ${cat2Data.monthlyLimit / 4},${cat2Data.monthlyLimit}, ${cat2Data.isPriority}, '${cat2Data.name}')`),
      pool.query(`INSERT INTO expense_info (users_id, daily_limit, weekly_limit, monthly_limit, is_priority, name) VALUES ('${req.cookies.id}', ${cat3DailyLimit}, ${cat3Data.monthlyLimit / 4}, ${cat3Data.monthlyLimit}, ${cat3Data.isPriority}, '${cat3Data.name}')`),
    ]).then((allResults) => {
      res.redirect('home');
    })
      .catch((error) => { console.log(error); });
  });
};

function setToMonday(date) {
  // Get current day number, converting Sun. to 7
  const day = date.getDay() || 7;
  // Only manipulate the date if it isn't Mon.
  // Set the hours to day number minus 1
  //   multiplied by negative 24
  if (day !== 1) date.setHours(-24 * (day - 1));
  return date;
}

const handleHomePage = (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('splash');
  }
  const loggedInID = req.cookies.id;
  const homeDataQuery = Promise.all([
    pool.query(`SELECT first_name, last_name FROM users WHERE users.id = ${loggedInID}`),
    pool.query(`SELECT * FROM expense_info WHERE users_id = ${loggedInID}`),
  ]).then((allResults) => {
    const homeData = {
      firstName: allResults[0].rows[0].first_name,
      lastName: allResults[0].rows[0].last_name,
      cat1Name: allResults[1].rows[0].name,
      cat1ID: allResults[1].rows[0].id,
      cat1DailyLimit: allResults[1].rows[0].daily_limit,
      cat1WeeklyLimit: allResults[1].rows[0].weekly_limit,
      cat1MonthlyLimit: allResults[1].rows[0].monthly_limit,
      cat2Name: allResults[1].rows[1].name,
      cat2ID: allResults[1].rows[1].id,
      cat2DailyLimit: allResults[1].rows[1].daily_limit,
      cat2WeeklyLimit: allResults[1].rows[1].weekly_limit,
      cat2MonthlyLimit: allResults[1].rows[1].monthly_limit,
      cat3Name: allResults[1].rows[2].name,
      cat3ID: allResults[1].rows[2].id,
      cat3DailyLimit: allResults[1].rows[2].daily_limit,
      cat3WeeklyLimit: allResults[1].rows[2].weekly_limit,
      cat3MonthlyLimit: allResults[1].rows[2].monthly_limit,
    };
    const monday = dateFormat(setToMonday(new Date()), 'isoDate');
    const today = dateFormat(new Date(), 'isoDate');
    const expenseDataQuery = Promise.all([
      pool.query(`SELECT * FROM expense_entry WHERE expense_info_id = ${homeData.cat1ID} AND created_at = '${today}'`),
      pool.query(`SELECT * FROM expense_entry WHERE expense_info_id = ${homeData.cat2ID} AND created_at = '${today}'`),
      pool.query(`SELECT * FROM expense_entry WHERE expense_info_id = ${homeData.cat3ID} AND created_at = '${today}'`),
    ]).then((expenseResults) => {
      let cat1TotalExpense = 0.00;
      let cat2TotalExpense = 0.00;
      let cat3TotalExpense = 0.00;
      expenseResults[0].rows.forEach((entry) => {
        cat1TotalExpense += Number(entry.amount);
      });
      expenseResults[1].rows.forEach((entry) => {
        cat2TotalExpense += Number(entry.amount);
      });
      expenseResults[2].rows.forEach((entry) => {
        cat3TotalExpense += Number(entry.amount);
      });
      const cat1DailyRatio = `${(cat1TotalExpense / homeData.cat1DailyLimit) * 100}%`;
      const cat2DailyRatio = `${(cat2TotalExpense / homeData.cat2DailyLimit) * 100}%`;
      const cat3DailyRatio = `${(cat3TotalExpense / homeData.cat3DailyLimit) * 100}%`;
      const dailyExpenses = {
        cat1: cat1TotalExpense,
        cat1DailyRatio,
        cat2: cat2TotalExpense,
        cat2DailyRatio,
        cat3: cat3TotalExpense,
        cat3DailyRatio,
      };
      res.render('home', { homeData, dailyExpenses });
    });
    // res.send('ERROR')
  });
};

const handleAddExpenseGet = (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('getcutdown');
  }
  pool.query(`SELECT * FROM expense_info where users_id = ${req.cookies.id}`, (err, result) => {
    const data = {
      categories: result.rows,
    };
    res.render('addexpense', data);
  });
};

const handleAddExpensePost = (req, res) => {
  console.log(req.body.categoryID);
  console.log(req.body.expenseAmt);
  console.log(req.body.date);
  const addQuery = 'INSERT INTO expense_entry (amount, expense_info_id, created_at) VALUES ($1, $2, $3)';
  pool.query(addQuery, [req.body.expenseAmt, req.body.categoryID, req.body.date], (err, result) => {
    res.redirect('home');
  });
};

app.get('/logout', (req, res) => {
  res.clearCookie('loggedIn');
  res.clearCookie('id');
  res.redirect('getcutdown');
});

app.get('/getcutdown', checkAuth, handleSplashPage);
app.get('/register', handleSignUpPage);
app.get('/login', checkAuth, handleLogInPage);
app.get('/goalsetting', checkAuth, handleGoalSettingPage);
app.get('/questionnaire', checkAuth, handleQuestionnairePage);
app.get('/home', checkAuth, handleHomePage);
app.get('/', checkAuth, handleHomePage);
app.get('/addexpense', checkAuth, handleAddExpenseGet);
app.post('/register', handleSignUpPost);
app.post('/login', handleLogInPost);
app.post('/goalsetting', handleGoalSettingPost);
app.post('/questionnaire', handleQuestionnairePost);
app.post('/addexpense', handleAddExpensePost);

app.listen(PORT);
