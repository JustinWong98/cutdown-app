DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS goals;
DROP TABLE IF EXISTS user_page;
DROP TABLE IF EXISTS expense_info;
DROP TABLE IF EXISTS expense_entry;


CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT, email TEXT, password TEXT, first_name TEXT, last_name TEXT);
CREATE TABLE IF NOT EXISTS goals (id SERIAL PRIMARY KEY, users_id INTEGER, target_savings NUMERIC(8,2), current_savings NUMERIC(8,2), days_goal INTEGER, days_current INTEGER, created_at DATE, main_goal TEXT);
CREATE TABLE IF NOT EXISTS user_page (id SERIAL PRIMARY KEY, users_id INTEGER);
CREATE TABLE IF NOT EXISTS expense_info (id SERIAL PRIMARY KEY, users_id INTEGER, daily_limit NUMERIC(8,2), weekly_limit NUMERIC(8,2), monthly_limit NUMERIC(8,2), is_priority BOOLEAN NOT NULL, name TEXT);
CREATE TABLE IF NOT EXISTS expense_entry (id SERIAL PRIMARY KEY, amount NUMERIC(8,2), expense_info_id INTEGER, created_at DATE);