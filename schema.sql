CREATE TABLE Student (
    StudentID INT PRIMARY KEY,
    StudentName VARCHAR(100) NOT NULL,
    PhoneNo VARCHAR(20),
    DOB DATE,
    Email VARCHAR(100)
);

CREATE TABLE Teacher (
    TeacherID INT PRIMARY KEY,
    TeacherName VARCHAR(100) NOT NULL,
    Email VARCHAR(100),
    PhoneNo VARCHAR(20)
);

CREATE TABLE Courses (
    CourseID INT PRIMARY KEY,
    CourseNmae VARCHAR(100) NOT NULL,
    CreditHours INT,
    TeacherID INT,
    FOREIGN KEY (TeacherID) REFERENCES Teacher(TeacherID)
);

CREATE TABLE Enrollment (
    EnrollmentID INT PRIMARY KEY,
    StudentID INT NOT NULL,
    CourseID INT NOT NULL,
    EnrollmentDate DATE,
    FOREIGN KEY (StudentID) REFERENCES Student(StudentID),
    FOREIGN KEY (CourseID) REFERENCES Courses(CourseID)
);

CREATE TABLE Results (
    ResultID INT PRIMARY KEY,
    EnrollmentID INT NOT NULL,
    Grade VARCHAR(5),
    GPA DECIMAL(3,2),
    FOREIGN KEY (EnrollmentID) REFERENCES Enrollment(EnrollmentID)
);