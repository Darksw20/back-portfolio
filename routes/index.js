const express = require("express");
const router = express.Router();
const db = require('../database/db');


/* GET home page. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

// Health Check Endpoint
router.get('/health', async (req, res) => {
  try {
    // Check the database connection
    await db.query('SELECT 1');

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

router.get("/skill", async (req, res, next) => {
  const results = await db.query("SELECT * FROM generic_skills");
  console.log(results);
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
});

router.get("/project", (req, res, next) => {
  const PROJECTS = [
    {
      name: "Huaro Web System",
      src: "/img/Huaro.JPG",
      date: "08-17",
      description:
        "Web system for organizers to automate scoring process in sports championship.",
      roles: ["web", "mobile", "uiux", "pm"],
    },
    {
      name: "Port1",
      src: "/img/HuaroM.png",
      date: "08-17",
      description: "Lorem ipsum, dolor sit amet consectetur adipisicing.",
      roles: ["photo"],
    },
    {
      name: "Port1",
      src: "/img/HuaroM.png",
      date: "08-17",
      description:
        "Attended the fourth Campus Party in Guadalajara and worked as Game Designer and programmer in a project to create a game about the experience of beign in the event.",
      roles: ["photo"],
    },
    {
      name: "Port1",
      src: "/img/HuaroM.png",
      date: "08-17",
      description:
        "Developed an App to automate the scoring process at an annual private sports championship (Huaro) with an attendance of about 500 people; making results more reliable to the atendees.",
      roles: ["photo"],
    },
    {
      name: "Port1",
      src: "/img/HuaroM.png",
      date: "08-17",
      description:
        "Participated on the team that developed 100 laterns made of recyclable materials to be sent to the victims of the 19/09 earthquake in Mexico.",
      roles: ["photo"],
    },
    {
      name: "Port1",
      src: "/img/HuaroM.png",
      date: "08-17",
      description:
        "Developed an App to maintain control on the registration process of a national event for the ASMAC (Asociacion de Scouts de Mexico A.C.), with more than 10,000 participants; improving 250 times the speed of such process.",
      roles: ["photo"],
    },
    {
      name: "Port1",
      src: "/img/HuaroM.png",
      date: "08-17",
      description:
        "Within the frame of the Distributed Systems className, worked as a project manager of the team responsible of developing an Ecommerce.",
      roles: ["photo"],
    },
  ];
  res.json(PROJECTS);
});

router.get("/role", (req, res, next) => {
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
  res.json(ROLES);
});

// Continuous Database Health Check
const healthCheckInterval = 60000; // 1 minute interval
setInterval(async () => {
  try {
    await db.query('SELECT 1');
    console.log('Database health check passed.');
  } catch (error) {
    console.error('Database health check failed:', error);
  }
}, healthCheckInterval);

module.exports = router;
