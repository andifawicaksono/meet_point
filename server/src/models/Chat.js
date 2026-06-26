module.exports = (sequelize, DataTypes) => {
  const Chat = sequelize.define(
    'Chat',
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
      authorId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'author_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Message content cannot be blank' },
          len: { args: [1, 4000], msg: 'Message cannot exceed 4000 characters' },
        },
      },
      replyToId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'reply_to_id',
        references: { model: 'chats', key: 'id' },
        onDelete: 'SET NULL',
      },
      mentions: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        defaultValue: [],
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
    },
    {
      tableName: 'chats',
      underscored: true,
      timestamps: false,
    },
  );

  return Chat;
};
