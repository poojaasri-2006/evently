const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const register = async (req, res) => {
  try {
    const { fullName, email, phone, password, role, businessName, businessCategory, businessLocation } = req.body;

    const lowerEmail = email.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [firstName, ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ');

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: lowerEmail,
          password: hashedPassword,
          role,
        }
      });

      if (role === 'ORGANIZER') {
        await tx.organizerProfile.create({
          data: {
            userId: user.id,
            firstName: firstName || '',
            lastName: lastName || '',
            phone: phone || null,
          }
        });
      } else if (role === 'VENDOR') {
        let category = null;
        if (businessCategory) {
          category = await tx.vendorCategory.upsert({
            where: { name: businessCategory },
            update: {},
            create: { name: businessCategory }
          });
        }

        await tx.vendorProfile.create({
          data: {
            userId: user.id,
            businessName: businessName || '',
            phone: phone || null,
            categoryId: category ? category.id : null,
            city: businessLocation ? businessLocation.trim() : null,
          }
        });
      }

      return user;
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: result.id,
        fullName: fullName,
        email: result.email,
        role: result.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error registering user' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error logging in' });
  }
};

const getMe = async (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role,
    organizerProfile: req.organizer || null, vendorProfile: req.vendor || null });
};

module.exports = {
  register,
  login,
  getMe
};
