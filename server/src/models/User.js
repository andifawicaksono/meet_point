const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;
const ROLES = ['guest', 'member', 'room_owner', 'super_admin'];

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Name cannot be blank' },
          len: { args: [1, 100], msg: 'Name must be 1-100 characters' },
        },
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: { msg: 'Must be a valid email address' },
          notEmpty: { msg: 'Email cannot be blank' },
        },
      },
      // Store the raw password here before create/update; hook hashes it in place.
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'password_hash',
      },
      role: {
        type: DataTypes.ENUM(...ROLES),
        allowNull: false,
        defaultValue: 'member',
        validate: {
          isIn: { args: [ROLES], msg: `Role must be one of: ${ROLES.join(', ')}` },
        },
      },
      avatarUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'avatar_url',
        validate: {
          isUrl: { msg: 'Avatar URL must be a valid URL', args: true },
        },
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_login_at',
      },
    },
    {
      tableName: 'users',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      hooks: {
        beforeCreate: async (user) => {
          if (user.passwordHash) {
            user.passwordHash = await bcrypt.hash(user.passwordHash, SALT_ROUNDS);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed('passwordHash') && user.passwordHash) {
            user.passwordHash = await bcrypt.hash(user.passwordHash, SALT_ROUNDS);
          }
        },
      },
      defaultScope: {
        attributes: { exclude: ['passwordHash'] },
      },
    },
  );

  User.prototype.comparePassword = async function (plain) {
    if (!this.passwordHash) return false;
    return bcrypt.compare(plain, this.passwordHash);
  };

  return User;
};
