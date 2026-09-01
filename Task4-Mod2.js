var Student = /** @class */ (function () {
    function Student(id, name, age, status) {
        if (status === void 0) { status = "Active"; }
        this.id = id;
        this.name = name;
        this.age = age;
        this.status = status;
    }
    return Student;
}());
var student1 = new Student(1, "Shabih", 20, "Active");
var student2 = new Student(2, "Hassan", 20, "Inactive");
console.log("Student 1:", student1);
console.log("Student 2:", student2);
// Testing an invalid status value
var invalidStudent = new Student(3, "Saad", 22, "banana");
console.log("Invalid Student:", invalidStudent);
