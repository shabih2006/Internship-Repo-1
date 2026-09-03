import { StudentRepository } from '../repositories/student.repository';
import { CreateStudentDto } from '../dtos/student.dto.js';

const studentRepository = new StudentRepository();

export class StudentService {
  async getAllStudents() {
    return studentRepository.findAll();
  }

  async getStudentById(id: number) {
    const student = await studentRepository.findById(id);
    if (!student) {
      throw new Error('Student not found.');
    }
    return student;
  }

  async createStudent(data: CreateStudentDto) {
    return studentRepository.create({
      StudentID: Number(data.StudentID),
      StudentName: data.StudentName,
      PhoneNo: data.PhoneNo,
      DOB: data.DOB,
      Email: data.Email,
    });
  }

  async deleteStudent(id: number) {
    return studentRepository.delete(id);
  }
}