const VALID_ACTIONS = [
  'REGISTER', 'LOGIN', 'LOGOUT',
  'ROOM_CREATED', 'ROOM_JOINED',
  'DRAW', 'STICKY_CREATED',
  'CHAT_SENT', 'VOTE_CAST',
  'FILE_EXPORTED', 'PARTICIPANT_REMOVED',
];

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      roomId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'room_id',
        references: { model: 'rooms', key: 'id' },
        onDelete: 'SET NULL',
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Action cannot be blank' },
          isIn: { args: [VALID_ACTIONS], msg: `Action must be one of: ${VALID_ACTIONS.join(', ')}` },
        },
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      ipAddress: {
        // Use raw string so Sequelize passes 'INET' directly to PG without translation
        type: 'INET',
        allowNull: true,
        field: 'ip_address',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
    },
    {
      tableName: 'audit_logs',
      underscored: true,
      timestamps: false,
    },
  );

  AuditLog.ACTIONS = Object.freeze(
    Object.fromEntries(VALID_ACTIONS.map((a) => [a, a])),
  );

  return AuditLog;
};
