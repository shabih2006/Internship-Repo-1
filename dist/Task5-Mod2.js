"use strict";
class repository {
    constructor() {
        this.items = [];
    }
    add(item) {
        this.items.push(item);
    }
    getAll() {
        return this.items;
    }
}
const studentRepository = new repository();
studentRepository.add({ id: 1, name: "Shabih" });
const courseRepository = new repository();
courseRepository.add({ id: 101, title: "TypeScript 101" });
console.log("Students:", studentRepository.getAll());
console.log("Courses:", courseRepository.getAll());
