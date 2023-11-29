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

router.get("/project", async (req, res, next) => {
  const results = await db.query("SELECT p.name AS project_name, p.src AS project_src, p.date AS project_date, p.description AS project_description, GROUP_CONCAT(r.value) AS roles FROM projects p JOIN project_roles pr ON p.id = pr.project_id JOIN roles r ON pr.role_id = r.id GROUP BY p.id;");
  const parsedResults = results.map(result => {
    return {
      name: result.project_name,
      src: result.project_src,
      date: result.project_date,
      description: result.project_description,
      roles: result.roles ? result.roles.split(',') : [] // Split roles into an array
    };
  });
  console.log(results);
  res.json(parsedResults);
});

router.get("/role", async (req, res, next) => {
  const results = await db.query("SELECT name,value FROM roles");
  res.json(results);
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
