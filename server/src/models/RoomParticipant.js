const ROLES = ['owner', 'member', 'guest'];

module.exports = (sequelize, DataTypes) => {
  const RoomParticipant = sequelize.define(
    'RoomParticipant',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      roomId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'room_id',
        references: { model: 'rooms', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      role: {
        type: DataTypes.ENUM(...ROLES),
        allowNull: false,
        defaultValue: 'member',
        validate: {
          isIn: { args: [ROLES], msg: `Role must be one of: ${ROLES.join(', ')}` },
        },
      },
      joinedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'joined_at',
      },
      isOnline: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_online',
      },
      cursorColor: {
        type: DataTypes.STRING(7),
        allowNull: true,
        field: 'cursor_color',
        validate: {
          is: { args: /^#[0-9A-Fa-f]{6}$/, msg: 'Cursor color must be a valid hex color (#RRGGBB)' },
        },
      },
    },
    {
      tableName: 'room_participants',
      underscored: true,
      timestamps: false,
      indexes: [
        { unique: true, fields: ['room_id', 'user_id'] },
      ],
    },
  );

  return RoomParticipant;
};
