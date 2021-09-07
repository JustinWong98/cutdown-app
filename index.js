/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
// REFACTOR
// REMOVE % FOR DAILY EXPENSES?
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
const handleSplashPage = (req, res) => {
  if (req.isUserLoggedIn !== false) {
    res.redirect('home');
  }
  res.render('getcutdown');
};

const handleSignUpPage = (req, res) => {
  res.render('register');
};

const handleSignUpPost = (req, res) => {
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
      pool.query(insertQuery, insertData, (insertErr, insertResult) => {
        if (insertErr) { throw insertErr; }
        const msg = 'You have succesfully registered!';
        res.render('login', { alertMsg: msg });
      });
    }
  });
};

const handleLogInPage = (req, res) => {
  if (req.isUserLoggedIn !== false) {
    res.redirect('home');
  }
  res.render('login');
};

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
  const currentMonth = (new Date()).getMonth() + 1;
  const insertData = [req.cookies.id, formData.goalCost, 0, formData.days, 0, req.body.date, formData.goalName, formData.mainGoal, currentMonth, 0];
  const goalInsertQuery = 'INSERT INTO goals (users_id, target_savings, current_savings, days_goal, days_current, created_at, goal_name, main_goal, tracked_month, saved_this_month) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)';
  pool.query(goalInsertQuery, insertData, (err, result) => {
    res.render('questionnaire');
  });
};

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
    const expenseQuery = Promise.all([
      pool.query(`INSERT INTO expense_info (users_id, daily_limit, weekly_limit, monthly_limit, original_expense, is_priority, name) VALUES ('${req.cookies.id}', ${cat1DailyLimit}, ${cat1Data.monthlyLimit / 4}, ${cat1Data.monthlyLimit}, ${req.body.cat1Amt}, ${cat1Data.isPriority}, '${cat1Data.name}')`),
      pool.query(`INSERT INTO expense_info (users_id, daily_limit, weekly_limit, monthly_limit, original_expense, is_priority, name) VALUES ('${req.cookies.id}', ${cat2DailyLimit}, ${cat2Data.monthlyLimit / 4},${cat2Data.monthlyLimit}, ${req.body.cat2Amt}, ${cat2Data.isPriority}, '${cat2Data.name}')`),
      pool.query(`INSERT INTO expense_info (users_id, daily_limit, weekly_limit, monthly_limit, original_expense, is_priority, name) VALUES ('${req.cookies.id}', ${cat3DailyLimit}, ${cat3Data.monthlyLimit / 4}, ${cat3Data.monthlyLimit}, ${req.body.cat3Amt}, ${cat3Data.isPriority}, '${cat3Data.name}')`),
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
function setToSunday(dateNow) {
  // Get current day number, converting Sun. to 7
  const date = setToMonday(dateNow);
  const day = date.getDay() || 7;
  // Only manipulate the date if it isn't Sun.
  // Set the hours to day number plus 1
  //   multiplied by negative 24
  if (day !== 7) date.setHours(24 * 6);
  return date;
}
function findStartOfMonth(date)
{
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

const dateNow = new Date();
const handleHomePage = (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('getcutdown');
  }
  const { date } = res.locals;
  const today = dateFormat(date, 'isoDate');
  const todayUnformatted = new Date(date);
  const monday = dateFormat(setToMonday(date), 'isoDate');
  const startOfMonthUnformatted = findStartOfMonth(todayUnformatted).toString();
  const startOfMonth = dateFormat(startOfMonthUnformatted, 'isoDate');
  const homePromise = new Promise((resolve, reject) => {
    Promise.all([
      pool.query(`SELECT first_name, last_name FROM users WHERE users.id = ${req.cookies.id}`),
      pool.query(`SELECT * FROM expense_info WHERE users_id = ${req.cookies.id}`),
      pool.query(`SELECT tracked_month FROM goals WHERE users_id = ${req.cookies.id}`),
    ]).then((allResults) => {
      const [userData, catData, monthData] = allResults;
      const trackedMonth = monthData.rows[0].tracked_month;
      const homeData = {
        ...userData.rows[0],
        categories: catData.rows,
      };
      resolve(homeData);
    });
  });
  homePromise.then((homeData) => {
    const dailyQueriesID = [homeData.categories[0].id, homeData.categories[1].id, homeData.categories[2].id];
    Promise.all(
      dailyQueriesID.map((id) => pool.query(`SELECT * FROM expense_entry WHERE expense_info_id = ${id} AND created_at = '${today}'`)),
    ).then((expenseResults) => {
      pool.query(`SELECT tracked_month FROM goals WHERE users_id = ${req.cookies.id}`).then((monthResult) => {
        // get current month generated by computer
        const newMonth = date.getMonth() + 1;
        const trackedMonth = monthResult.rows[0].tracked_month;
        // this is false if last time page requested was in same month
        // this is true if last time page requested was previous month
        if (newMonth > trackedMonth || (newMonth === 1 && trackedMonth === 12)) {
          // monthly expenditures reset
          // current savings display
          pool.query(`UPDATE goals SET current_savings = (current_savings + saved_this_month), days_current = (days_current + 30), tracked_month = ${newMonth} WHERE users_id = ${req.cookies.id}`).then(() => {
          });
        }
        const dailyExpenseArray = [0.00, 0.00, 0.00];
        for (let i = 0; i < expenseResults.length; i += 1) {
          expenseResults[i].rows.forEach((entry) => {
            dailyExpenseArray[i] += Number(entry.amount);
          });
        }
        const totalDailyExpensesArray = [dailyExpenseArray[0], dailyExpenseArray[1], dailyExpenseArray[2]];
        const dailyRatios = [];
        totalDailyExpensesArray.forEach((expense, j) => dailyRatios.push(`${((expense / homeData.categories[j].daily_limit) * 100).toFixed(2)}%`));
        const dailyExpenses = {
          cat1: (dailyExpenseArray[0]).toFixed(2),
          cat1Ratio: dailyRatios[0],
          cat2: (dailyExpenseArray[1]).toFixed(2),
          cat2Ratio: dailyRatios[1],
          cat3: (dailyExpenseArray[2]).toFixed(2),
          cat3Ratio: dailyRatios[2],
        };
        return dailyExpenses; }).then((dailyExpenses) => {
        const weeklyQuery = Promise.all(
          dailyQueriesID.map((id) => pool.query(`SELECT * FROM expense_entry WHERE expense_info_id = ${id} AND created_at BETWEEN '${monday}' and '${today}'`)),
        ).then((weeklyResults) => {
          const weeklyExpenseArray = [0.00, 0.00, 0.00];
          for (let i = 0; i < weeklyResults.length; i += 1) {
            weeklyResults[i].rows.forEach((entry) => {
              weeklyExpenseArray[i] += Number(entry.amount);
            });
          }
          const totalWeeklyExpensesArray = [weeklyExpenseArray[0], weeklyExpenseArray[1], weeklyExpenseArray[2]];
          const weeklyRatios = [];
          totalWeeklyExpensesArray.forEach((expense, j) => weeklyRatios.push(`${((expense / homeData.categories[j].weekly_limit) * 100).toFixed(2)}%`));
          const weeklyExpenses = {
            cat1: (weeklyExpenseArray[0]).toFixed(2),
            cat1Ratio: weeklyRatios[0],
            cat2: (weeklyExpenseArray[1]).toFixed(2),
            cat2Ratio: weeklyRatios[1],
            cat3: (weeklyExpenseArray[2]).toFixed(2),
            cat3Ratio: weeklyRatios[2],
          };
          return weeklyExpenses;
        }).then((weeklyExpenses) => {
          const monthlyQuery = Promise.all(
            dailyQueriesID.map((id) => pool.query(`SELECT * FROM expense_entry WHERE expense_info_id = ${id} AND created_at BETWEEN '${startOfMonth}' and '${today}'`)),
          ).then((monthlyResults) => {
          // const [monthlyStuffResults, trackedMonth] = monthlyResults;
            const monthlyExpenseArray = [0.00, 0.00, 0.00];
            for (let i = 0; i < monthlyResults.length; i += 1) {
              monthlyResults[i].rows.forEach((entry) => {
                monthlyExpenseArray[i] += Number(entry.amount);
              });
            }
            const totalMonthlyExpensesArray = [monthlyExpenseArray[0], monthlyExpenseArray[1], monthlyExpenseArray[2]];
            pool.query(`SELECT * FROM expense_info WHERE users_id = ${req.cookies.id}`).then((results) => {
            // separate the amounts saved for each cat
              const monthlySavedArray = [(results.rows[0].original_expense - totalMonthlyExpensesArray[0]), (results.rows[1].original_expense - totalMonthlyExpensesArray[1]), (results.rows[2].original_expense - totalMonthlyExpensesArray[2])];
              // add them together to get total amount saved that month
              const totalMonthlySaved = monthlySavedArray[0] + monthlySavedArray[1] + monthlySavedArray[2];
              // add current savings
              pool.query(`UPDATE goals SET saved_this_month = ${totalMonthlySaved} WHERE users_id = ${req.cookies.id}`).then((monthlyRes) => {
                const monthlyRatios = [];
                const progressReportArray = [];
                totalMonthlyExpensesArray.forEach((expense, j) => {
                  const percentage = ((expense / homeData.categories[j].monthly_limit) * 100).toFixed(2);
                  const percentageLeft = (100 - percentage).toFixed(2);
                  if (percentage < 50) {
                    progressReportArray.push(`Good job on keeping costs low so far! You've only spent ${percentage}% of your monthly budget so far!`);
                  }
                  else if (percentage < 75 && percentage >= 50) {
                    progressReportArray.push(`You have spent about ${percentage}% of your monthly budget. Perhaps you might want to keep a close eye on that.`);
                  }
                  else if (percentage < 90 && percentage >= 75) {
                    progressReportArray.push(`Uhoh, you have spent about ${percentage}% of your monthly budget. You have about ${percentageLeft}% before you hit your cap. Be careful!`);
                  }
                  else if (percentage < 100 && percentage >= 90) {
                    progressReportArray.push(`DANGER! You are about to hit your monthly budget cap with about ${percentageLeft} % left!`);
                  }
                  else {
                    progressReportArray.push('YOU HAVE BURST YOUR BUDGET!');
                  }
                  monthlyRatios.push(`${percentage}%`); });
                const monthlyExpenses = {
                  cat1: (monthlyExpenseArray[0]).toFixed(2),
                  cat1Ratio: monthlyRatios[0],
                  cat2: (monthlyExpenseArray[1]).toFixed(2),
                  cat2Ratio: monthlyRatios[1],
                  cat3: (monthlyExpenseArray[2]).toFixed(2),
                  cat3Ratio: monthlyRatios[2],
                };
                const progressReport = {
                  cat1: progressReportArray[0],
                  cat2: progressReportArray[1],
                  cat3: progressReportArray[2],
                };
                pool.query(`SELECT target_savings, current_savings, days_goal, days_current FROM goals WHERE users_id = ${req.cookies.id}`).then((savingsRes) => {
                  const targetSavings = savingsRes.rows[0].target_savings;
                  const currentSavings = savingsRes.rows[0].current_savings;
                  const amountLeftToSave = targetSavings - currentSavings;
                  const percentage = ((currentSavings / targetSavings) * 100).toFixed(2);
                  const monthsLeft = (savingsRes.rows[0].days_goal - savingsRes.rows[0].days_current) / 30;
                  const summary = {
                    targetSavings, currentSavings, amountLeftToSave, percentage,
                  };
                  const currentDay = dateFormat(today, 'fullDate');
                  const currentMonth = dateFormat(today, 'mmmm');
                  const sunday = dateFormat(setToSunday(date), 'fullDate');
                  const mondayDisplay = dateFormat(monday, 'fullDate');
                  const dates = {
                    currentDay, currentMonth, mondayDisplay, sunday, monthsLeft,
                  };
                  const expenseIDs = { dailyQueriesID };
                  res.render('home', {
                    homeData, dailyExpenses, weeklyExpenses, monthlyExpenses, progressReport, summary, dates, expenseIDs,
                  });
                });
              });
            });
          });
        });
      });
    });
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

const handleUserPage = (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('getcutdown');
  }
  pool.query(`SELECT * FROM goals WHERE goals.users_id = '${req.cookies.id}'`, (err, result) => {
    const data = {
      goal: result.rows[0].main_goal,
    };
    res.render('userpage', data);
  });
};

const handleEditGoals = (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('getcutdown');
  }
  pool.query(`SELECT * FROM goals WHERE goals.users_id = '${req.cookies.id}'`, (err, result) => {
    const data = result.rows[0];
    res.render('editGoalSetting', data);
  });
};

const handleEditGoalsPost = (req, res) => {
  const formData = {
    goalName: req.body.goalName,
    goalCost: req.body.goalCost,
    mainGoal: req.body.mainGoal,
    currentSavings: req.body.currentSavings,
    days: Number(req.body['months-goal']) * 30,
  };
  const testQuery = `UPDATE goals SET days_goal = ${formData.days}, goal_name = '${formData.goalName}', main_goal = '${formData.mainGoal}', target_savings = '${formData.goalCost}', currentSavings = '${formData.currentSavings}' WHERE users_id = ${req.cookies.id}`;
  pool.query(testQuery, (err, result) => {
    res.redirect('questionnaire');
  });
};

const handleEditQuestionnaire = (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('getcutdown');
  }
  pool.query(`SELECT expense_info.monthly_limit, expense_info.is_priority, expense_info.name, expense_info.original_expense, goals.days_goal, goals.target_savings FROM expense_info INNER JOIN goals on goals.users_id = expense_info.users_id WHERE expense_info.users_id = ${req.cookies.id}`, (err, result) => {
    const categories = {
      cat1Name: result.rows[0].name,
      cat1InitialAmt: result.rows[0].original_expense,
      cat2Name: result.rows[1].name,
      cat2InitialAmt: result.rows[1].original_expense,
      cat3Name: result.rows[2].name,
      cat3InitialAmt: result.rows[2].original_expense,
    };
    res.render('editQuestionnaire', categories);
  });
};

const handleEditQuestionnairePost = (req, res) => {
  const monthQuery = 'SELECT days_goal, target_savings FROM goals WHERE users_id = $1';
  Promise.all([
    pool.query(`SELECT days_goal, target_savings FROM goals WHERE users_id = ${req.cookies.id}`),
    pool.query(`SELECT id FROM expense_info WHERE users_id = ${req.cookies.id}`),
  ]).then((result) => {
    const days = result[0].rows[0].days_goal;
    const cutdownPerMonth = Number(result[0].rows[0].target_savings) / (days / 30);
    const nonPriorityCutdown = cutdownPerMonth / 4;
    let priority = '';
    const expenseIDArray = [result[1].rows[0].id, result[1].rows[1].id, result[1].rows[2].id];
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
    const expenseQuery = Promise.all([
      pool.query(`UPDATE expense_info SET daily_limit = ${cat1DailyLimit}, weekly_limit = ${cat1Data.monthlyLimit / 4}, monthly_limit = ${cat1Data.monthlyLimit}, original_expense = ${req.body.cat1Amt}, is_priority = ${cat1Data.isPriority}, name = '${cat1Data.name}' WHERE id = ${expenseIDArray[0]}`),
      pool.query(`UPDATE expense_info SET daily_limit = ${cat2DailyLimit}, weekly_limit = ${cat2Data.monthlyLimit / 4}, monthly_limit = ${cat2Data.monthlyLimit}, original_expense = ${req.body.cat2Amt}, is_priority = ${cat2Data.isPriority}, name = '${cat2Data.name}' WHERE id = ${expenseIDArray[1]}`),
      pool.query(`UPDATE expense_info SET daily_limit = ${cat3DailyLimit}, weekly_limit = ${cat3Data.monthlyLimit / 4}, monthly_limit = ${cat3Data.monthlyLimit}, original_expense = ${req.body.cat3Amt}, is_priority = ${cat3Data.isPriority}, name = '${cat3Data.name}' WHERE id = ${expenseIDArray[2]}`),
    ]).then((allResults) => {
      res.redirect('home');
    })
      .catch((error) => { console.log(error); });
  });
};

const handleGetExpenseList = (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('getcutdown');
  }
  const { id } = req.params;
  pool.query(`SELECT * FROM expense_entry WHERE expense_info_id = ${id}`).then((results) => {
    const dataObj = { data: results.rows };
    dataObj.data.forEach((i) => {
      const dateFormatted = dateFormat(i.created_at, 'fullDate');
      i.created_at = dateFormatted;
    });
    res.render('catList', dataObj);
  });
};

const handleDeleteExpense = (req, res) => {
  const { id } = req.params;
  pool.query(`DELETE FROM expense_entry WHERE id = ${id}`).then(() => {
    res.redirect('/home');
  });
};

const handleEditExpenseGet = (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('getcutdown');
  }
  const { id } = req.params;
  pool.query(`SELECT amount, expense_info_id FROM expense_entry WHERE id = ${id}`).then((result) => {
    const data = {
      amount: result.rows[0].amount,
      expenseID: result.rows[0].expense_info_id,
    };
    res.render('editexpense', data);
  });
};

const handleEditExpensePost = (req, res) => {
  pool.query(`UPDATE expense_entry SET amount = ${req.body.expenseAmt} WHERE id = ${req.params.id}`);
  res.redirect('/home');
};

const currentDay = (req, res, next) => {
  const currentDate = new Date();
  const realDate = currentDate.getDate();
  currentDate.setDate(realDate);
  res.locals.date = currentDate;
  next();
};

const oneMonthLater = (req, res, next) => {
  const currentDate = new Date();
  currentDate.setMonth(9);
  res.locals.date = currentDate;
  next();
};

app.get('/getcutdown', checkAuth, handleSplashPage);
app.get('/register', handleSignUpPage);
app.get('/login', checkAuth, handleLogInPage);
app.get('/goalsetting', checkAuth, handleGoalSettingPage);
app.get('/questionnaire', checkAuth, handleQuestionnairePage);
app.get('/home', checkAuth, currentDay, handleHomePage);
app.get('/', checkAuth, currentDay, handleHomePage);
app.get('/addexpense', checkAuth, handleAddExpenseGet);
app.get('/user', checkAuth, handleUserPage);
app.get('/editGoalSetting', checkAuth, handleEditGoals);
app.get('/editQuestionnaire', checkAuth, handleEditQuestionnaire);
app.get('/expenseList/:id', checkAuth, handleGetExpenseList);
app.get('/expenseList/catList/:id/delete', handleDeleteExpense);
app.get('/expenseList/catList/:id/edit', checkAuth, handleEditExpenseGet);
app.get('/timeMachine', checkAuth, oneMonthLater, handleHomePage);
app.post('/register', handleSignUpPost);
app.post('/login', handleLogInPost);
app.post('/goalsetting', handleGoalSettingPost);
app.post('/questionnaire', handleQuestionnairePost);
app.post('/addexpense', handleAddExpensePost);
app.post('/editGoalSetting', handleEditGoalsPost);
app.post('/editQuestionnaire', handleEditQuestionnairePost);
app.post('/expenseList/catList/:id/edit', handleEditExpensePost);

app.listen(PORT);
