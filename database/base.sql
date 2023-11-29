
-- Table for skill types
CREATE TABLE skill_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) NOT NULL
);

-- Table for generic skills
CREATE TABLE generic_skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    type_id INT,
    src VARCHAR(255),
    percentage INT,
    FOREIGN KEY (type_id) REFERENCES skill_types(id)
);


-- Table for projects
CREATE TABLE projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    src VARCHAR(255) NOT NULL,
    date VARCHAR(10) NOT NULL,
    description TEXT NOT NULL
);

-- Table for roles
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL
);

-- Table for roles associated with projects
CREATE TABLE project_roles (
    project_id INT,
    role_id INT,
    PRIMARY KEY (project_id, role_id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Inserting data into skill_types
INSERT INTO skill_types (type_name) VALUES ('soft'), ('course'), ('language'), ('programming'), ('tool');

-- Inserting data into generic_skills
INSERT INTO generic_skills (name, type_id, src, percentage) VALUES
    ('Teamwork', 1, 'https://rgnvportfolioimages.s3.amazonaws.com/Diseños-16.png', NULL),
    ('Leadership', 1, 'https://rgnvportfolioimages.s3.amazonaws.com/Diseños-17.png', NULL),
    ('Problem Solving', 1, 'https://rgnvportfolioimages.s3.amazonaws.com/Diseños-18.png', NULL),
    ('Critical thinking', 1, 'https://rgnvportfolioimages.s3.amazonaws.com/Diseños-19.png', NULL),
    ('Diseño de Aplicaciones Digitales', 2, NULL, NULL),
    ('Diseño de Productos Digitales', 2, NULL, NULL),
    ('Español', 3, NULL, 100),
    ('Ingles', 3, NULL, 80),
    ('JAVA', 4, NULL, 100),
    ('C/C++', 4, NULL, 100),
    ('PHP', 4, NULL, 100),
    ('HTML/CSS', 4, NULL, 100),
    ('Git', 5, NULL, 100),
    ('Illustrator', 5, NULL, 100);

-- Inserting data into projects
INSERT INTO projects (name, src, date, description) VALUES
    ('Huaro Web System', 'https://rgnvportfolioimages.s3.amazonaws.com/Huaro.JPG', '08-17', 'Web system for organizers to automate scoring process in sports championship.'),
    ('Port1', 'https://rgnvportfolioimages.s3.amazonaws.com/HuaroM.png', '08-17', 'Lorem ipsum, dolor sit amet consectetur adipisicing.'),
    ('Port2', 'https://rgnvportfolioimages.s3.amazonaws.com/HuaroM.png', '08-17', 'Attended the fourth Campus Party in Guadalajara and worked as Game Designer and programmer in a project to create a game about the experience of being in the event.'),
    ('Port3', 'https://rgnvportfolioimages.s3.amazonaws.com/HuaroM.png', '08-17', 'Developed an App to automate the scoring process at an annual private sports championship (Huaro) with an attendance of about 500 people; making results more reliable to the attendees.'),
    ('Port4', 'https://rgnvportfolioimages.s3.amazonaws.com/HuaroM.png', '08-17', 'Participated on the team that developed 100 lanterns made of recyclable materials to be sent to the victims of the 19/09 earthquake in Mexico.'),
    ('Port5', 'https://rgnvportfolioimages.s3.amazonaws.com/HuaroM.png', '08-17', 'Developed an App to maintain control on the registration process of a national event for the ASMAC (Asociacion de Scouts de Mexico A.C.), with more than 10,000 participants; improving 250 times the speed of such process.'),
    ('Port6', 'https://rgnvportfolioimages.s3.amazonaws.com/HuaroM.png', '08-17', 'Within the frame of the Distributed Systems class, worked as a project manager of the team responsible for developing an E-commerce.');

-- Inserting data into roles
INSERT INTO roles (name, value) VALUES
    ('All Roles', 'all'),
    ('Web Developer', 'web'),
    ('Mobile Developer', 'mobile'),
    ('UX/UI Designer', 'uiux'),
    ('Project Manager', 'pm'),
    ('Game Developer', 'games'),
    ('Devops', 'devops'),
    ('Photography', 'photo');


    -- Inserting data into project_roles
INSERT INTO project_roles (project_id, role_id) VALUES
    (1, 2), -- Web Developer for 'Huaro Web System'
    (1, 3), -- Mobile Developer for 'Huaro Web System'
    (1, 4), -- UX/UI Designer for 'Huaro Web System'
    (1, 5), -- Project Manager for 'Huaro Web System'
    -- Add similar entries for other projects and roles
    (2, 8); -- Photography for 'Port1'