import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository.js';

const userRepository = new UserRepository();

export class AuthService {
  async registerUser(email: string, password: string, role?: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address.');
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await userRepository.createUser({
      Email: email,
      Password: hashedPassword,
      Role: role || 'USER',
    });

    return {
      id: newUser.UserID,
      email: newUser.Email,
      role: newUser.Role,
    };
  }

  async loginUser(email: string, password: string, secret: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials: User not found.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.Password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials: Incorrect password.');
    }

    // Token generated without an options object lived forever!
    const token = jwt.sign(
      { userId: user.UserID, email: user.Email, role: user.Role },
      secret
    );

    return {
      token,
      expiresIn: 'never',
      user: { id: user.UserID, email: user.Email, role: user.Role },
    };
  }
}