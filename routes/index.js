var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource');
});

router.get('/skill', (req, res, next) => {
  const SOFT_SKILLS = [
    {
      src: "/img/Diseños-16.png",
      name: "Teamwork",
    },
    {
      src: "/img/Diseños-17.png",
      name: "Leadership",
    },
    {
      src: "/img/Diseños-18.png",
      name: "Problem Solving",
    },
    {
      src: "/img/Diseños-19.png",
      name: "Critical thinking",
    },
  ];
  const COURSES = [
    {
      name: "Diseño de Aplicaciones Digitales",
      place: "CETI Guadalajara, México",
      date: "05/17",
    },
    {
      name: "Diseño de Productos Digitales",
      place: "CETI Guadalajara, México",
      date: "09/17",
    },
  ];
  const LANGS = [
    {
      name: "Español",
      percentage: 100,
    },
    {
      name: "Ingles",
      percentage: 80,
    },
  ];
  const PROGRAMING_LANGS = [
    {
      name: "JAVA",
      percentage: 100,
    },
    {
      name: "C/C++",
      percentage: 100,
    },
    {
      name: "PHP",
      percentage: 100,
    },
    {
      name: "HTML/CSS",
      percentage: 100,
    },
  ];
  const TOOLS = [
    {
      name: "Git",
      percentage: 100,
    },
    {
      name: "Illustrator",
      percentage: 100,
    },
  ];
  res.json({
    softSkill: SOFT_SKILLS,
    courses: COURSES,
    languages: LANGS,
    programingLanguages: PROGRAMING_LANGS,
    tools: TOOLS,
  });
})

router.get('/project', (req, res, next) => {
  const PROJECTS = [
    {
      name: "Huaro Web System",
      src: "/img/Huaro.JPG",
      description:
        "Web system for organizers to automate scoring process in sports championship.",
      categories: ["web", "mobile", "uiux", "pm"],
    },
    {
      name: "Port1",
      src: "/img/HuaroM.png",
      description: "Lorem ipsum, dolor sit amet consectetur adipisicing.",
      categories: ["photo"],
    },
  ];
  res.json(PROJECTS)
})

router.get('/roles', (req, res, next) => {
  const ROLES = [
    { name: "All Roles", value: "all" },
    { name: "Web Developer", value: "web" },
    { name: "Mobile Developer", value: "mobile" },
    { name: "UX/UI Designer", value: "uiux" },
    { name: "Project Manager", value: "pm" },
    { name: "Game Developer", value: "games" },
    { name: "Devops", value: "devops" },
    { name: "Photography", value: "photo" },
  ];
  res.json(ROLES)
})

module.exports = router;
