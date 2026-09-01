import * as readline from "readline";

interface Student {
  id: number;
  name: string;
}

const students: Student[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function startMenu() {
  console.log("\n************");
  console.log("Welcome to the Student Management System");
  console.log("1. Add new Student");
  console.log("2. View Students");
  console.log("3. Update Student Data");
  console.log("4. Delete Student Data");
  console.log("5. Exit");
  console.log("************\n");

  rl.question("Please select an option (1-5): ", (answer) => {
    try {
      switch (answer.trim()) {
        case "1":
          rl.question("Enter student name: ", (name) => {
            try {
              if (!name.trim())
                throw new Error("Student name cannot be empty!");
              const newStudent: Student = {
                id: students.length + 1,
                name: name.trim(),
              };
              students.push(newStudent);
              console.log(
                "Success: Added student '" +
                  newStudent.name +
                  "' with ID #" +
                  newStudent.id +
                  "!",
              );
            } catch (err) {
              if (err instanceof Error) console.log("\nError: " + err.message);
            }
            startMenu();
          });
          break;

        case "2":
          console.log("\n--- Current Student List ---");
          if (students.length === 0) {
            console.log("No students found in database.");
          } else {
            students.forEach((s) =>
              console.log("ID: " + s.id + " | Name: " + s.name),
            );
          }
          startMenu();
          break;

        case "3":
          rl.question("Enter student ID to update: ", (idInput) => {
            rl.question("Enter new name: ", (newName) => {
              try {
                const id = parseInt(idInput.trim(), 10);
                const student = students.find((s) => s.id === id);
                if (!student)
                  throw new Error(
                    "Student with ID #" + idInput + " not found!",
                  );
                if (!newName.trim())
                  throw new Error("New name cannot be empty!");

                student.name = newName.trim();
                console.log(
                  "Success: Updated Student #" +
                    id +
                    " name to '" +
                    student.name +
                    "'!",
                );
              } catch (err) {
                if (err instanceof Error)
                  console.log("\nError: " + err.message);
              }
              startMenu();
            });
          });
          break;

        case "4":
          rl.question("Enter student ID to delete: ", (idInput) => {
            try {
              const id = parseInt(idInput.trim(), 10);
              const index = students.findIndex((s) => s.id === id);
              if (index === -1)
                throw new Error("Student with ID #" + idInput + " not found!");

              const removed = students.splice(index, 1);
              console.log(
                "Success: Removed student '" + removed[0]!.name + "'!",
              );
            } catch (err) {
              if (err instanceof Error) console.log("\nError: " + err.message);
            }
            startMenu();
          });
          break;

        case "5":
          console.log("\nExiting system. Goodbye!");
          rl.close();
          break;

        default:
          throw new Error(
            "Invalid option! Please select a number between 1 and 5.",
          );
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log("\nError: " + error.message);
        startMenu();
      }
    }
  });
}

startMenu();
