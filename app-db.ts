import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

app.use(express.json());

// ========================================================
// AUTHENTICATION MIDDLEWARE
// ========================================================
interface AuthenticatedRequest extends Request {
  user?: any;
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token.' });
      return;
    }
    req.user = user;
    next();
  });
};

// ========================================================
// 1. AUTH / USER ENDPOINTS
// ========================================================

app.post('/auth/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { Email: email } });
    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists.' });
      return;
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

app.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { Email: email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials: User not found.' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.Password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials: Incorrect password.' });
      return;
    }

    const token = jwt.sign(
      { userId: user.UserID, email: user.Email, role: user.Role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful!',
      token,
      user: { id: user.UserID, email: user.Email, role: user.Role },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

app.get('/auth/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users.' });
  }
});

app.get('/auth/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { UserID: Number(req.params.id) } });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user.' });
  }
});

app.patch('/auth/users/:id', async (req: Request, res: Response): Promise<void> => {
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
      res.status(400).json({ error: 'No valid fields provided for update.' });
      return;
    }

    const updated = await prisma.user.update({
      where: { UserID: userId },
      data: updateData,
    });

    res.json({ message: 'User updated successfully!', user: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error updating user.' });
  }
});

app.delete('/auth/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.user.delete({ where: { UserID: Number(req.params.id) } });
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting user.' });
  }
});

// ========================================================
// 2. STUDENT ENDPOINTS
// ========================================================
app.get('/students', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const students = await prisma.student.findMany();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching students.' });
  }
});

app.get('/students/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.student.findUnique({ where: { StudentID: Number(req.params.id) } });
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching student.' });
  }
});

app.post('/students', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

app.patch('/students/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

app.delete('/students/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await prisma.student.delete({ where: { StudentID: Number(req.params.id) } });
    res.json({ message: 'Student deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting student.' });
  }
});

// ========================================================
// 3. TEACHER ENDPOINTS
// ========================================================
app.get('/teachers', async (req: Request, res: Response): Promise<void> => {
  try {
    const teachers = await prisma.teacher.findMany();
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching teachers.' });
  }
});

app.get('/teachers/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { TeacherID: Number(req.params.id) } });
    if (!teacher) {
      res.status(404).json({ error: 'Teacher not found.' });
      return;
    }
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching teacher.' });
  }
});

app.post('/teachers', async (req: Request, res: Response): Promise<void> => {
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

app.patch('/teachers/:id', async (req: Request, res: Response): Promise<void> => {
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

app.delete('/teachers/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.teacher.delete({ where: { TeacherID: Number(req.params.id) } });
    res.json({ message: 'Teacher deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting teacher.' });
  }
});

// ========================================================
// 4. COURSES ENDPOINTS
// ========================================================
app.get('/courses', async (req: Request, res: Response): Promise<void> => {
  try {
    const courses = await prisma.courses.findMany();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching courses.' });
  }
});

app.get('/courses/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const course = await prisma.courses.findUnique({ where: { CourseID: Number(req.params.id) } });
    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching course.' });
  }
});

app.post('/courses', async (req: Request, res: Response): Promise<void> => {
  try {
    const { CourseID, CourseName, CourseCode } = req.body;
    const newCourse = await prisma.courses.create({
      data: {
        CourseID: Number(CourseID),
        CourseName: String(CourseName),
        CourseCode: String(CourseCode),
      } as any,
    });
    res.status(201).json(newCourse);
  } catch (error) {
    res.status(500).json({ error: 'Error creating course.' });
  }
});

app.patch('/courses/:id', async (req: Request, res: Response): Promise<void> => {
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

app.delete('/courses/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.courses.delete({ where: { CourseID: Number(req.params.id) } });
    res.json({ message: 'Course deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting course.' });
  }
});

// ========================================================
// 5. ENROLLMENT ENDPOINTS
// ========================================================
app.get('/enrollments', async (req: Request, res: Response): Promise<void> => {
  try {
    const enrollments = await prisma.enrollment.findMany();
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching enrollments.' });
  }
});

app.post('/enrollments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { StudentID, CourseID } = req.body;
    if (!StudentID || !CourseID) {
      res.status(400).json({ error: 'StudentID and CourseID are required.' });
      return;
    }
    const newEnrollment = await prisma.enrollment.create({
      data: {
        StudentID: Number(StudentID),
        CourseID: Number(CourseID),
      } as any,
    });
    res.status(201).json(newEnrollment);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating enrollment.' });
  }
});

app.patch('/enrollments/:id', async (req: Request, res: Response): Promise<void> => {
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

app.delete('/enrollments/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.enrollment.delete({ where: { EnrollmentID: Number(req.params.id) } });
    res.json({ message: 'Enrollment deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting enrollment.' });
  }
});

// ========================================================
// 6. RESULTS ENDPOINTS
// ========================================================
app.get('/results', async (req: Request, res: Response): Promise<void> => {
  try {
    const results = await prisma.results.findMany();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching results.' });
  }
});

app.post('/results', async (req: Request, res: Response): Promise<void> => {
  try {
    const { EnrollmentID, Marks, Grade } = req.body;

    if (!EnrollmentID || Marks === undefined || !Grade) {
      res.status(400).json({ error: 'EnrollmentID, Marks, and Grade are required.' });
      return;
    }

    const newResult = await prisma.results.create({
      data: {
        EnrollmentID: Number(EnrollmentID),
        Marks: Number(Marks),
        Grade: String(Grade),
      } as any,
    });

    res.status(201).json(newResult);
  } catch (error: any) {
    console.error('CREATE RESULT ERROR:', error);
    res.status(500).json({ error: error.message || 'Error creating result record.' });
  }
});

app.patch('/results/:id', async (req: Request, res: Response): Promise<void> => {
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

app.delete('/results/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.results.delete({ where: { ResultID: Number(req.params.id) } });
    res.json({ message: 'Result record deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting result record.' });
  }
});

// 404 HANDLER
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});