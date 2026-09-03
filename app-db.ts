import express from 'express';
import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// ========================================================
// 1. AUTH / USER ENDPOINTS (FULL CRUD)
// ========================================================

// REGISTER
app.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { Email: email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        Email: email,
        Password: hashedPassword,
        Role: role || 'USER',
      },
    });

    res.status(201).json({
      message: 'User registered successfully!',
      user: { id: newUser.UserID, email: newUser.Email, role: newUser.Role },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// LOGIN
app.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { Email: email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials: User not found.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.Password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials: Incorrect password.' });
    }

    res.status(200).json({
      message: 'Login successful!',
      user: { id: user.UserID, email: user.Email, role: user.Role },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// GET ALL USERS
app.get('/auth/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users.' });
  }
});

// GET USER BY ID
app.get('/auth/users/:id', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { UserID: Number(req.params.id) } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user.' });
  }
});

// PATCH USER (AUTO-HASHES PASSWORD IF PROVIDED)
app.patch('/auth/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { password, email, role } = req.body;

    const updateData: Record<string, any> = {};

    if (password) {
      updateData.Password = await bcrypt.hash(password, 10);
    }
    if (email) {
      updateData.Email = email;
    }
    if (role) {
      updateData.Role = role;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const updated = await prisma.user.update({
      where: { UserID: userId },
      data: updateData,
    });

    res.json({ message: 'User updated successfully!', user: updated });
  } catch (error: any) {
    console.error('PATCH USER ERROR:', error);
    res.status(500).json({ error: error.message || 'Error updating user.' });
  }
});

// DELETE USER
app.delete('/auth/users/:id', async (req: Request, res: Response) => {
  try {
    await prisma.user.delete({ where: { UserID: Number(req.params.id) } });
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting user.' });
  }
});


// ========================================================
// 2. STUDENT ENDPOINTS (FULL CRUD)
// ========================================================
app.get('/students', async (req: Request, res: Response) => {
  try {
    const students = await prisma.student.findMany();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching students.' });
  }
});

app.get('/students/:id', async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { StudentID: Number(req.params.id) } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching student.' });
  }
});

app.post('/students', async (req: Request, res: Response) => {
  try {
    const { StudentID, StudentName, PhoneNo, DOB, Email } = req.body;
    const newStudent = await prisma.student.create({
      data: { StudentID: Number(StudentID), StudentName, PhoneNo, DOB, Email },
    });
    res.status(201).json(newStudent);
  } catch (error) {
    res.status(500).json({ error: 'Error creating student.' });
  }
});

app.patch('/students/:id', async (req: Request, res: Response) => {
  try {
    const updated = await prisma.student.update({
      where: { StudentID: Number(req.params.id) },
      data: req.body,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating student.' });
  }
});

app.delete('/students/:id', async (req: Request, res: Response) => {
  try {
    await prisma.student.delete({ where: { StudentID: Number(req.params.id) } });
    res.json({ message: 'Student deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting student.' });
  }
});


// ========================================================
// 3. TEACHER ENDPOINTS (FULL CRUD)
// ========================================================
app.get('/teachers', async (req: Request, res: Response) => {
  try {
    const teachers = await prisma.teacher.findMany();
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching teachers.' });
  }
});

app.get('/teachers/:id', async (req: Request, res: Response) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { TeacherID: Number(req.params.id) } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching teacher.' });
  }
});

app.post('/teachers', async (req: Request, res: Response) => {
  try {
    const { TeacherID, TeacherName, Email, PhoneNo } = req.body;
    const newTeacher = await prisma.teacher.create({
      data: { TeacherID: Number(TeacherID), TeacherName, Email, PhoneNo },
    });
    res.status(201).json(newTeacher);
  } catch (error) {
    res.status(500).json({ error: 'Error creating teacher.' });
  }
});

app.patch('/teachers/:id', async (req: Request, res: Response) => {
  try {
    const updated = await prisma.teacher.update({
      where: { TeacherID: Number(req.params.id) },
      data: req.body,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating teacher.' });
  }
});

app.delete('/teachers/:id', async (req: Request, res: Response) => {
  try {
    await prisma.teacher.delete({ where: { TeacherID: Number(req.params.id) } });
    res.json({ message: 'Teacher deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting teacher.' });
  }
});


// ========================================================
// 4. COURSES ENDPOINTS (FULL CRUD)
// ========================================================
app.get('/courses', async (req: Request, res: Response) => {
  try {
    const courses = await prisma.courses.findMany();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching courses.' });
  }
});

app.get('/courses/:id', async (req: Request, res: Response) => {
  try {
    const course = await prisma.courses.findUnique({ where: { CourseID: Number(req.params.id) } });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching course.' });
  }
});

app.post('/courses', async (req: Request, res: Response) => {
  try {
    const { CourseID, CourseName, CourseCode } = req.body;
    const newCourse = await prisma.courses.create({
      data: { CourseID: Number(CourseID), CourseName, CourseCode },
    });
    res.status(201).json(newCourse);
  } catch (error) {
    res.status(500).json({ error: 'Error creating course.' });
  }
});

app.patch('/courses/:id', async (req: Request, res: Response) => {
  try {
    const updated = await prisma.courses.update({
      where: { CourseID: Number(req.params.id) },
      data: req.body,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating course.' });
  }
});

app.delete('/courses/:id', async (req: Request, res: Response) => {
  try {
    await prisma.courses.delete({ where: { CourseID: Number(req.params.id) } });
    res.json({ message: 'Course deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting course.' });
  }
});


// ========================================================
// 5. ENROLLMENT ENDPOINTS (FULL CRUD)
// ========================================================
app.get('/enrollments', async (req: Request, res: Response) => {
  try {
    const enrollments = await prisma.enrollment.findMany();
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching enrollments.' });
  }
});

app.post('/enrollments', async (req: Request, res: Response) => {
  try {
    const { StudentID, CourseID } = req.body;
    const newEnrollment = await prisma.enrollment.create({
      data: {
        StudentID: Number(StudentID),
        CourseID: Number(CourseID),
      },
    });
    res.status(201).json(newEnrollment);
  } catch (error) {
    res.status(500).json({ error: 'Error creating enrollment.' });
  }
});

app.patch('/enrollments/:id', async (req: Request, res: Response) => {
  try {
    const updated = await prisma.enrollment.update({
      where: { EnrollmentID: Number(req.params.id) },
      data: req.body,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating enrollment.' });
  }
});

app.delete('/enrollments/:id', async (req: Request, res: Response) => {
  try {
    await prisma.enrollment.delete({ where: { EnrollmentID: Number(req.params.id) } });
    res.json({ message: 'Enrollment deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting enrollment.' });
  }
});


// ========================================================
// 6. RESULTS ENDPOINTS (FULL CRUD)
// ========================================================
app.get('/results', async (req: Request, res: Response) => {
  try {
    const results = await prisma.results.findMany();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching results.' });
  }
});

app.post('/results', async (req: Request, res: Response) => {
  try {
    const { EnrollmentID, Marks, Grade } = req.body;
    const newResult = await prisma.results.create({
      data: {
        EnrollmentID: Number(EnrollmentID),
        Marks: Number(Marks),
        Grade,
      },
    });
    res.status(201).json(newResult);
  } catch (error) {
    res.status(500).json({ error: 'Error creating result record.' });
  }
});

app.patch('/results/:id', async (req: Request, res: Response) => {
  try {
    const updated = await prisma.results.update({
      where: { ResultID: Number(req.params.id) },
      data: req.body,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating result record.' });
  }
});

app.delete('/results/:id', async (req: Request, res: Response) => {
  try {
    await prisma.results.delete({ where: { ResultID: Number(req.params.id) } });
    res.json({ message: 'Result record deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting result record.' });
  }
});


// ========================================================
// SERVER SETUP & 404 HANDLER
// ========================================================
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});