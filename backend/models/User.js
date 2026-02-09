const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Model (simple auth)
 * Fields:
 * - name
 * - email
 * - password (hashed)
 * - role (admin, finance, risk)
 * - createdAt
 */

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'finance', 'risk'], default: 'finance' },
}, { timestamps: true });

/**
 * Hash password before saving user
 */
UserSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * Compare plain password with hashed password
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.__v;
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
