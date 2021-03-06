/*
 * All routes for Users are defined here
 * Since this file is loaded in server.js into api/users,
 *   these routes are mounted onto /users
 * See: https://expressjs.com/en/guide/using-middleware.html#middleware.router
 */

const express = require('express');
const router  = express.Router();

// trying to get access to db helper functions
const hdb = require('../helper')
// to call the hlepr functions call dhp - since the methods already call on the db


module.exports = (db) => {
  // to see current users database - for dev
  router.get("/", (req, res) => {
    hdb.getAllUsers(`SELECT * FROM users;`)
      .then(data => {
        const users = data.rows;
        res.json({ users });
      })
      .catch(err => {
        res
          .status(500)
          .json({ error: err.message });
      });
  });

  // ---- NEW USER ------------------

  // users/new GET - goes to registration page
  router.get("/new", (req, res) =>  {
    // if user is already logged in
    if (req.session.user_id) {
      // redirect to homepage
      res.redirect('../');
    }
    const templateVars = {user_id: req.session.user_id};
    res.render("user_new", templateVars);
  });

  // users/:user_id/login GET - get login page - temp, will update to be more dynamci
  // this is for validation purposes
  router.get("/login", (req, res) =>  {
    // if user is already logged in
    if (req.session.user_id) {
      res.redirect('../');
    }
    const templateVars = {user_id: req.session.user_id};
    res.render("user_login", templateVars);
  });

  // users POST - create new account, add to users db, redirect to homepage
  router.post("/", (req, res) => {
    const user = req.body;
    hdb.addUser(user)
    .then(user => {
      // if user was not returned from db.addUser
      if (!user) {
        res.send({error: 'error: user not found / password incorrect'});
        return;
      }
      // if sucessful, user will be logged in and cookie assigned with user_id
      req.session.user_id = user.id;
      // will redirect to user_page with new info rendered
      res.redirect(`/users/${user.id}`);
    })
    .catch(e => res.send(e));
  });

  // ---- USER INFO AND MANAGEMENT (USER, LOGIN, LOGOUT, DELETE & EDIT) --------

  // users/:user_id  GET - get user page with their info and attempt history
  router.get("/:user_id", (req, res) => {
    const user_id = Number(req.params.user_id);
    // check if the user has access to this page
    if (user_id === req.session.user_id) {
      hdb.getUserWithId(user_id)
      .then(user => {
        const templateVars = {
          user_id: req.session.user_id,
            // this user object will have all info from users db
          user: user
        };
        // shows user_page with the user info based on templateVars
        res.render("user_page", templateVars);
      })
      .catch(e => res.send(e));
    } else {
      res.send('you dont have access to this page!');
    }
  });

  // users/:user_id/quizzes/new GET - if logged in, take to new quizzes page
  router.get("/:user_id/quizzes/new", (req, res) => {
    const user_id = req.session.user_id;
    const templateVars = {user_id};
    if (req.params.user_id == user_id) { //case where the user_id in the URL belongs to the logged in user
      res.render("new_quiz", templateVars);
    }
    else if (user_id) { //case where the user is logged in but wants to access another user's route
      res.render("error", {user_id, error: "Access Denied!"});
    }
    else { //case where the user is not logged in
      res.render("user_login", templateVars);
    }
  });

  // users/:user_id DELETE - delete user by removing from users db and redirect to homepage
  router.delete("/:user_id/delete", (req, res) => {
    const user_id = Number(req.params.user_id);
    // check if logged user is trying to delete owns page
    if (user_id === req.session.user_id) {
      // remove user from users db
      hdb.removeUser(user_id)
      .then(removedUser => {
        // resets cookie session
        req.session = null;
        // redirect to homepage
        res.redirect('/');
      })
      .catch(e => {res.send(e)});
    } else {
      res.send("user not logged in!");
    }
  });

  // users/:user_id/login POST - verify login field with user db, update session cookie if info correct
  router.post("/login", (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    hdb.login(email, password)
      // login function to return user info if creds correct
      .then( user => {
        // if creds not correct, null is returned from login
        if (!user) {
          res.send({error: 'error'});
          return;
        }
        // on success, cookie assigned with user_id
        req.session.user_id = user.id;
        // redirects to user page
        res.redirect(`/users/${user.id}`);
      })
      .catch(e => res.send(e));
  });

  // users/:user_id/logout POST - logout user by erasing session cookie
  router.post("/logout", (req, res) => {
    req.session = null;
    res.redirect("../");
  });

  // users/:user_id/edit GET - goes to user edit page
  router.get('/:user_id/edit', (req, res) => {
    const user_id = Number(req.params.user_id);
    // check if the user has access to this page
    if (user_id === req.session.user_id) {
      // render the page with the fields for edit
      const templateVars = { user_id: req.session.user_id };
      res.render('user_edit', templateVars);
    } else {
      res.send('you dont have access!');
    }
  });

  // users/:user_id PUT - edit user info by update user db and refresh page to show updated user info
  router.put('/:user_id', (req, res) => {
    const user_id = Number(req.params.user_id);
    // check if logged user is trying to edit owns page
    if (user_id === req.session.user_id) {
      const new_info = {
        id: user_id,
        name: req.body.name,
        email: req.body.email,
        password: req.body.password
      };
      // editUser helper should take two parameters, user_id and new info
      // it then updates the db
      hdb.editUser(new_info)
      .then ( newUser => {
        // with the new user info returned, cookie does not need to be updated
        // since user_id should remain the same
        // re-render the user_id page with new info
        res.redirect(`../`);
      })
    }
  });

  // ----- USER QUIZ ACCESS (ALL QUIZ LIST OR SINGLE QUIZ INFO) -------

  // users/:user_id/quizzes GET - goes to user all quizzes page, have all quizzes displayed in table
  router.get('/:user_id/quizzes', (req, res) => {
    const user_id = Number(req.params.user_id);
    if (user_id === req.session.user_id) {
      hdb.getQuizzesByUserId(user_id)
      .then (quizzes => {
        // quizzes should be all the quiz that belongs to the user_id
        // given back as an array of objects
        const templateVars = {user_id: req.session.user_id, quizzes: quizzes};
        // render page that will show all quizzes into table
        res.render("user_quizzes", templateVars);
      })
      .catch(e => res.send(e));
    } else {
      res.send('you dont have access!');
    }
  });

  // users/:user_id/quizzes/:quiz_id GET - goes to quiz page with creator access
  router.get('/:user_id/quizzes/:quiz_id', (req, res) => {
    const user_id = Number(req.params.user_id);
    if (user_id === req.session.user_id) {
      // get the quiz info
      const quiz_id = (req.params.quiz_id);
      hdb.getQuizWithQuizId(quiz_id)
      .then (quiz => {
        // check if the cookie user = quiz user id (creator looking at the quiz)
        if (Number(quiz.creator_id) === req.session.user_id) {
          // quiz info here to render
          const templateVars = { quiz: quiz, user_id: req.params.user_id };
          // page rendering for quiz to be viewed by creator
          res.render('user_quiz', templateVars);
        } else {
          res.send('you dont have access!');
        }
      })
      .catch(e => res.send(e));
    }
  });

  // users/:user_id/quizzes/:quiz_id/edit GET - goes to quiz edit page with creator access
  router.get('/:user_id/quizzes/:quiz_id/edit', (req, res) => {
    const user_id = Number(req.params.user_id);
    if (user_id === req.session.user_id) {
      const quiz_id = (req.params.quiz_id);
      hdb.getQuizWithQuizId(quiz_id)
      .then (quiz => {

        let orderQues = quiz.questions;
        orderQues.sort(function(a, b) {
        let keyA = a.question_id;
        let keyB = b.question_id;
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
        return 0;
        });

        if (Number(quiz.creator_id) === req.session.user_id) {
          // quiz info here to render
          const templateVars = { quiz: quiz, user_id: req.session.user_id };
          // render the page with the fields for edit
          res.render('user_quiz_edit', templateVars);

        } else {
          res.send('you dont have access!');
        }
      })
      .catch(e => res.send(e));
    }
  });

  // added visibility change to update quiz page
  // users/:user_id/quizzes/:quiz_id/edit PUT - change visibility
  router.put('/:user_id/quizzes/:quiz_id/edit', (req, res) => {
    const quiz_id = req.params.quiz_id;
    hdb.editVisibility(quiz_id)
    .then(result => {
      res.redirect(`back`);
    })
    .catch (e => {
      res.status(500).send(e);
    })
  });

  // users/:user_id/quizzes/:quiz_id PUT - update quiz info from edit page
  router.put('/:user_id/quizzes/:quiz_id', (req, res) => {
    // check if the cookie user = quiz user id (creator looking at the quiz)
    console.log('accessing route /users/:user_id/quizzes/:quiz_id')
    // console.log(req.body)
    // req.body is an object
    // Q# will be the question + all answers
    // each key after that that is
    // get quiz details to make newQuiz obj
    const newQuiz = {
      quizId : req.params.quiz_id,
      owner_id: req.session.user_id,
      title: req.body.title,
      description: req.body.description,
      photo_url: req.body.photo_url,
      category: req.body.category,
      visibility: req.body.visibility,
      questions: {}
    };

    // remove the keys from req.body
    delete req.body.title;
    delete req.body.description;
    delete req.body.photo_url;
    delete req.body.category;
    delete req.body.visibility;

    // Messy Creation of the new Quiz Object questions
    let formArray= Object.keys(req.body); //quiz_id
    // console.log(formArray)
    let questions = [];
    let answerVal = [];
    let count = 0;
    for(let i = 0; i < formArray.length; i ++) {
      if(formArray[i].split("A")[1])
      {
        newQuiz.questions[formArray[i].split("Q")[1].split("A")[0]].answers[formArray[i].split("A")[1]] = [req.body[formArray[i]], false]; // add answer
      } else if (formArray[i].split("_")[1]) {
        newQuiz.questions[formArray[i].split("_")[1]].answers[req.body[formArray[i]]][1] = true; // add the correct answer
      } else {
        newQuiz.questions[formArray[i].split("Q")[1]] = { text : req.body[formArray[i]], answers : {}} // add question
      }


    }

    const user_id = Number(req.params.user_id);
    if (user_id === req.session.user_id) {
      const quiz_id = Number(req.params.quiz_id);
      // console.log('calling the get quiz_id function')
      hdb.editQuiz(newQuiz)
      .then(res.redirect(`back`))
      .catch(e => console.log(e));
    } else {
      res.send('you dont have access!')
    }
  });

  // users/:user_id/quizzies/:quiz_id/delete - deletes quiz from quizzes db
  router.delete('/:user_id/quizzes/:quiz_id/delete', (req, res) => {
    // check if the cookie user = quiz creator id
    const user_id = Number(req.params.user_id);
    if (user_id === req.session.user_id) {
      const quiz_id = Number(req.params.quiz_id);
      hdb.getQuizWithQuizId(quiz_id)
      .then (quiz => {
          hdb.removeQuiz(quiz.quiz_id)
          .then ( result => {
            // redirect to user's quizzes page
            res.redirect(`../`);
          })
          .catch(e => res.send(e));
        // }
      });
    } else {
      res.send('you dont have access!');
    }
  });

  return router;
};
