CREATE TABLE users (
    id serial PRIMARY KEY,
    email varchar(255),
    username varchar(20),
    password varchar(255),
    summary varchar(255),
    motivation varchar(255),
    linkedin varchar(255),
    github varchar(255)
);

CREATE TABLE contacts (
    id serial PRIMARY KEY,
    name varchar(255),
    email varchar(255),
    message varchar(255),
    user_id integer,
    CONSTRAINT contacts_user_id
        FOREIGN KEY(user_id)
            REFERENCES users(id)
);

CREATE TABLE achievements (
    id serial PRIMARY KEY,
    title varchar(255),
    description varchar(255),
    place varchar(255),
    url varchar(255),
    start_date date,
    end_date date,
    type varchar(255),
    user_id integer,
    CONSTRAINT achivement_user_id
        FOREIGN KEY(user_id)
            REFERENCES users(id)
);

CREATE TABLE skills (
    id serial PRIMARY KEY,
    image varchar(255),
    name varchar(255),
    type varchar(255),
    percent int
);

CREATE TABLE roles (
    id serial PRIMARY KEY,
    image varchar(255),
    name varchar(255),
    percent int
);

CREATE TABLE images (
    id serial PRIMARY KEY,
    name varchar(255),
    file_extension varchar(255),
    file_type varchar(255)
);

CREATE TABLE skill_achievements (
    id serial PRIMARY KEY,
    fk_skill int,
    fk_achievement int,
    CONSTRAINT fk_skill
        FOREIGN KEY(fk_skill)
            REFERENCES skills(id),
    CONSTRAINT fk_achievement
        FOREIGN KEY(fk_achievement)
            REFERENCES achievements(id)
);

CREATE TABLE roles_achievements (
    id serial PRIMARY KEY,
    fk_role int,
    fk_achievement int,
    CONSTRAINT fk_role
        FOREIGN KEY(fk_role)
            REFERENCES roles(id),
    CONSTRAINT fk_achievement
        FOREIGN KEY(fk_achievement)
            REFERENCES achievements(id)
);

CREATE TABLE images_achievements (
    id serial PRIMARY KEY,
    fk_image int,
    fk_achievement int,
    CONSTRAINT fk_image
        FOREIGN KEY(fk_image)
            REFERENCES images(id),
    CONSTRAINT fk_achievement
        FOREIGN KEY(fk_achievement)
            REFERENCES achievements(id)
);