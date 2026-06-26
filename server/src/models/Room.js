const STATUSES = ['active', 'closed'];

module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define(
    'Room',
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
          notEmpty: { msg: 'Room name cannot be blank' },
          len: { args: [1, 100], msg: 'Room name must be 1-100 characters' },
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      inviteCode: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        field: 'invite_code',
        validate: {
          notEmpty: { msg: 'Invite code cannot be blank' },
          len: { args: [6, 20], msg: 'Invite code must be 6-20 characters' },
        },
      },
      ownerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'owner_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      isLocked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_locked',
      },
      maxParticipants: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50,
        field: 'max_participants',
        validate: {
          min: { args: [2], msg: 'Room must allow at least 2 participants' },
          max: { args: [500], msg: 'Room cannot exceed 500 participants' },
        },
      },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: 'active',
        validate: {
          isIn: { args: [STATUSES], msg: `Status must be one of: ${STATUSES.join(', ')}` },
        },
      },
    },
    {
      tableName: 'rooms',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return Room;
};
