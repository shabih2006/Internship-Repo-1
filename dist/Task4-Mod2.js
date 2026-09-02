"use strict";
class Student {
    constructor(id, name, age, status = "Active") {
        this.id = id;
        this.name = name;
        this.age = age;
        this.status = status;
    }
}
const student1 = new Student(1, "Shabih", 20, "Active");
const student2 = new Student(2, "Hassan", 20, "Inactive");
console.log("Student 1:", student1);
console.log("Student 2:", student2);
// Testing an invalid status value
// const invalidStudent = new Student(3, "Saad", 22, "banana");
// console.log("Invalid Student:", invalidStudent);
