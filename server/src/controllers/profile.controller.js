const prisma = require('../utils/prisma');
const bcrypt = require('bcrypt');
const { deleteAccountData } = require('../utils/deleteAccountData');

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizerProfile: true,
        vendorProfile: {
          include: { category: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Do not return password
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, phone } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organizerProfile: true }
    });

    if (!user || !user.organizerProfile) {
      return res.status(404).json({ message: 'Organizer profile not found' });
    }

    const updatedProfile = await prisma.organizerProfile.update({
      where: { id: user.organizerProfile.id },
      data: {
        firstName: firstName !== undefined ? firstName : user.organizerProfile.firstName,
        lastName: lastName !== undefined ? lastName : user.organizerProfile.lastName,
        phone: phone !== undefined ? phone : user.organizerProfile.phone,
      }
    });

    res.json(updatedProfile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating profile' });
  }
};

const updatePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 100) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating password' });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    if (typeof password !== 'string' || !password) return res.status(400).json({ message: 'Password is required' });

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    await prisma.$transaction(tx => deleteAccountData(tx, userId), { timeout: 90000 });
    return res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting account' });
  }
}

const updateVendorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      businessName,
      description,
      phone,
      website,
      categoryId,
      imageUrl,
      address,
      city,
      state,
      postalCode
    } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user || !user.vendorProfile) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    const dataToUpdate = {};
    if (businessName !== undefined) dataToUpdate.businessName = businessName;
    if (description !== undefined) dataToUpdate.description = description;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (website !== undefined) dataToUpdate.website = website;
    if (categoryId !== undefined) dataToUpdate.categoryId = categoryId || null;
    if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl || null;
    if (address !== undefined) dataToUpdate.address = address || null;
    if (city !== undefined) dataToUpdate.city = city || null;
    if (state !== undefined) dataToUpdate.state = state || null;
    if (postalCode !== undefined) dataToUpdate.postalCode = postalCode || null;

    const updatedProfile = await prisma.vendorProfile.update({
      where: { id: user.vendorProfile.id },
      data: dataToUpdate,
      include: { category: true }
    });

    res.json(updatedProfile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating vendor profile' });
  }
};

const uploadVendorImage = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user || !user.vendorProfile) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    const protocol = req.protocol;
    const host = req.get('host');
    const imageUrl = `${protocol}://${host}/uploads/profiles/${req.file.filename}`;

    const updatedProfile = await prisma.vendorProfile.update({
      where: { id: user.vendorProfile.id },
      data: { imageUrl },
      include: { category: true }
    });

    res.json({
      message: 'Profile image uploaded successfully',
      imageUrl,
      vendorProfile: updatedProfile
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error uploading profile image' });
  }
};

const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId }, update: {},
      create: { userId, eventUpdates: true, vendorActivity: true, quotesAndBookings: true, generalSystem: true }
    });

    res.json(prefs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching notification preferences' });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventUpdates, vendorActivity, quotesAndBookings, generalSystem } = req.body;

    // Validate — only accept explicit booleans
    const data = {};
    if (typeof eventUpdates === 'boolean') data.eventUpdates = eventUpdates;
    if (typeof vendorActivity === 'boolean') data.vendorActivity = vendorActivity;
    if (typeof quotesAndBookings === 'boolean') data.quotesAndBookings = quotesAndBookings;
    if (typeof generalSystem === 'boolean') data.generalSystem = generalSystem;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No valid preference values provided' });
    }

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        eventUpdates: data.eventUpdates ?? true,
        vendorActivity: data.vendorActivity ?? true,
        quotesAndBookings: data.quotesAndBookings ?? true,
        generalSystem: data.generalSystem ?? true
      }
    });

    res.json(prefs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating notification preferences' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateVendorProfile,
  uploadVendorImage,
  updatePassword,
  deleteAccount,
  getNotificationPreferences,
  updateNotificationPreferences
};
