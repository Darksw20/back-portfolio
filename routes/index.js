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
  try {
    const query = `
      SELECT gs.name, gs.src, gs.percentage, st.type_name
      FROM generic_skills gs
      INNER JOIN skill_types st ON gs.type_id = st.id
    `;

    const results = await db.query(query);

    const skills = {
      softSkill: [],
      courses: [],
      languages: [],
      programingLanguages: [],
      tools: [],
    };

    results.forEach((row) => {
      const skill = {
        name: row.name,
        src: row.src,
        percentage: row.percentage,
      };

      switch (row.type_name) {
        case 'soft':
          skills.softSkill.push(skill);
          break;
        case 'course':
          skills.courses.push(skill);
          break;
        case 'language':
          skills.languages.push(skill);
          break;
        case 'programming':
          skills.programingLanguages.push(skill);
          break;
        case 'tool':
          skills.tools.push(skill);
          break;
        default:
          // Handle any other skill types as needed
          break;
      }
    });

    res.json(skills);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
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
