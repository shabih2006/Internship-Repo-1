-- CreateTable
CREATE TABLE "User" (
    "UserID" SERIAL NOT NULL,
    "Email" TEXT NOT NULL,
    "Password" TEXT NOT NULL,
    "Role" TEXT NOT NULL DEFAULT 'USER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("UserID")
);

-- CreateTable
CREATE TABLE "Student" (
    "StudentID" INTEGER NOT NULL,
    "StudentName" TEXT NOT NULL,
    "PhoneNo" TEXT,
    "DOB" TEXT,
    "Email" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("StudentID")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "TeacherID" INTEGER NOT NULL,
    "TeacherName" TEXT NOT NULL,
    "Email" TEXT,
    "PhoneNo" TEXT,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("TeacherID")
);

-- CreateTable
CREATE TABLE "Courses" (
    "CourseID" INTEGER NOT NULL,
    "CourseNmae" TEXT NOT NULL,
    "CreditHours" INTEGER NOT NULL,
    "TeacherID" INTEGER NOT NULL,

    CONSTRAINT "Courses_pkey" PRIMARY KEY ("CourseID")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "EnrollmentID" INTEGER NOT NULL,
    "StudentID" INTEGER NOT NULL,
    "CourseID" INTEGER NOT NULL,
    "EnrollmentDate" TEXT,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("EnrollmentID")
);

-- CreateTable
CREATE TABLE "Results" (
    "ResultID" INTEGER NOT NULL,
    "EnrollmentID" INTEGER NOT NULL,
    "Grade" TEXT,
    "GPA" DOUBLE PRECISION,

    CONSTRAINT "Results_pkey" PRIMARY KEY ("ResultID")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "aiReply" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_Email_key" ON "User"("Email");

-- AddForeignKey
ALTER TABLE "Courses" ADD CONSTRAINT "Courses_TeacherID_fkey" FOREIGN KEY ("TeacherID") REFERENCES "Teacher"("TeacherID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_StudentID_fkey" FOREIGN KEY ("StudentID") REFERENCES "Student"("StudentID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_CourseID_fkey" FOREIGN KEY ("CourseID") REFERENCES "Courses"("CourseID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Results" ADD CONSTRAINT "Results_EnrollmentID_fkey" FOREIGN KEY ("EnrollmentID") REFERENCES "Enrollment"("EnrollmentID") ON DELETE RESTRICT ON UPDATE CASCADE;
