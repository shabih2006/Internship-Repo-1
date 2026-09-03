export interface CreateStudentDto {
  StudentID: number;
  StudentName: string;
  PhoneNo: string;
  DOB: string;
  Email: string;
}

export interface UpdateStudentDto {
  StudentName?: string;
  PhoneNo?: string;
  DOB?: string;
  Email?: string;
}