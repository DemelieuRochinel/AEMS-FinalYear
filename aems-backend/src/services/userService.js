const db   = require('../config/firebase');
const bcrypt = require('bcryptjs');

const usersRef = db.ref('users');

const ROLES = {
  OWNER:      'BusinessOwner',
  STAFF:      'Staff',
  TECHNICIAN: 'Technician',
};

const createUser = async (userId, data) => {
  try {
    // Hash the password before saving — NEVER store plain text
    const hashedPassword = await bcrypt.hash(data.password, 12);

    const userData = {
      name:          data.name,
      email:         data.email.toLowerCase().trim(),
      phone:         data.phone      || null,
      password_hash: hashedPassword,
      role:          data.role       || ROLES.OWNER,  // ✅ FIXED
      business_id:   data.business_id || null,
      business_ids:  data.business_ids|| [],
      language:      data.language    || 'eng',
      created_at:    new Date().toISOString(),
      last_login:    null,

      notifications: {
        email:          data.notifications?.email     ?? true,
        urgent:         true,
        warnings:       true,
        daily_summary:  data.notifications?.daily_summary ?? true,
      },

      permissions: buildPermissions(data.role || ROLES.OWNER),  // ✅ FIXED
    };

    await usersRef.child(userId).set(userData);

    // Return user WITHOUT password hash
    const { password_hash, ...safeUser } = userData;
    return { success: true, userId, data: safeUser };

  } catch (error) {
    console.error('createUser error:', error.message);
    throw new Error(`Failed to create user: ${error.message}`);
  }
};

const buildPermissions = (role) => {
  const base = {
    view_dashboard:     true,
    control_devices:    false,
    view_reports:       false,
    change_settings:    false,
    manage_users:       false,
    view_all_businesses:false,
    install_devices:    false,
  };

  if (role === ROLES.STAFF) {
    return { ...base, control_devices: true };
  }

  if (role === ROLES.OWNER) {
    return {
      ...base,
      control_devices:  true,
      view_reports:     true,
      change_settings:  true,
    };
  }

  if (role === ROLES.TECHNICIAN) {
    return {
      ...base,
      control_devices:     true,
      view_reports:        true,
      change_settings:     true,
      view_all_businesses: true,
      install_devices:     true,
    };
  }

  return base;
};

const getUserById = async (userId) => {
  try {
    const snapshot = await usersRef.child(userId).once('value');
    if (!snapshot.exists()) return null;

    const { password_hash, ...safeUser } = snapshot.val();
    return { id: userId, ...safeUser };

  } catch (error) {
    console.error('getUserById error:', error.message);
    throw new Error(`Failed to get user: ${error.message}`);
  }
};

const getUserByEmail = async (email) => {
  try {
    const snapshot = await usersRef
      .orderByChild('email')
      .equalTo(email.toLowerCase().trim())
      .once('value');

    if (!snapshot.exists()) return null;

    let user = null;
    snapshot.forEach((child) => {
      user = { id: child.key, ...child.val() };
    });

    return user;

  } catch (error) {
    console.error('getUserByEmail error:', error.message);
    throw new Error(`Failed to find user: ${error.message}`);
  }
};

const authenticateUser = async (email, password) => {
  try {
    const user = await getUserByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return null;

    // Update last login
    await usersRef.child(user.id).update({
      last_login: new Date().toISOString(),
    });

    // Return safe user without password hash
    const { password_hash, ...safeUser } = user;
    return safeUser;

  } catch (error) {
    console.error('authenticateUser error:', error.message);
    throw new Error(`Authentication failed: ${error.message}`);
  }
};

module.exports = {
  ROLES,
  createUser,
  getUserById,
  getUserByEmail,
  authenticateUser,
  buildPermissions,
};