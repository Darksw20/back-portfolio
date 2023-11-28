-- Table for generic skills
CREATE TABLE generic_skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    type_id INT,
    src VARCHAR(255),
    percentage INT,
    FOREIGN KEY (type_id) REFERENCES skill_types(id)
);

-- Table for skill types
CREATE TABLE skill_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) NOT NULL
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

-- Inserting data into skill_types
INSERT INTO skill_types (type_name) VALUES ('soft'), ('course'), ('language'), ('programming'), ('tool');

-- Inserting data into generic_skills
INSERT INTO generic_skills (name, type_id, src, percentage) VALUES
    ('Teamwork', 1, '/img/Diseños-16.png', NULL),
    ('Leadership', 1, '/img/Diseños-17.png', NULL),
    ('Problem Solving', 1, '/img/Diseños-18.png', NULL),
    ('Critical thinking', 1, '/img/Diseños-19.png', NULL),
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
    ('Huaro Web System', '/img/Huaro.JPG', '08-17', 'Web system for organizers to automate scoring process in sports championship.'),
    ('Port1', '/img/HuaroM.png', '08-17', 'Lorem ipsum, dolor sit amet consectetur adipisicing.'),
    ('Port2', '/img/HuaroM.png', '08-17', 'Attended the fourth Campus Party in Guadalajara and worked as Game Designer and programmer in a project to create a game about the experience of being in the event.'),
    ('Port3', '/img/HuaroM.png', '08-17', 'Developed an App to automate the scoring process at an annual private sports championship (Huaro) with an attendance of about 500 people; making results more reliable to the attendees.'),
    ('Port4', '/img/HuaroM.png', '08-17', 'Participated on the team that developed 100 lanterns made of recyclable materials to be sent to the victims of the 19/09 earthquake in Mexico.'),
    ('Port5', '/img/HuaroM.png', '08-17', 'Developed an App to maintain control on the registration process of a national event for the ASMAC (Asociacion de Scouts de Mexico A.C.), with more than 10,000 participants; improving 250 times the speed of such process.'),
    ('Port6', '/img/HuaroM.png', '08-17', 'Within the frame of the Distributed Systems class, worked as a project manager of the team responsible for developing an E-commerce.');

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