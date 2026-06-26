const TYPES = ['idea', 'problem', 'solution', 'action_item'];

module.exports = (sequelize, DataTypes) => {
  const StickyNote = sequelize.define(
    'StickyNote',
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
      type: {
        type: DataTypes.ENUM(...TYPES),
        allowNull: false,
        validate: {
          isIn: { args: [TYPES], msg: `Type must be one of: ${TYPES.join(', ')}` },
        },
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: true,
        validate: {
          len: { args: [0, 200], msg: 'Title cannot exceed 200 characters' },
        },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      color: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#FBBF24',
        validate: {
          is: { args: /^#[0-9A-Fa-f]{6}$/, msg: 'Color must be a valid hex color (#RRGGBB)' },
        },
      },
      positionX: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
        field: 'position_x',
      },
      positionY: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
        field: 'position_y',
      },
      voteCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'vote_count',
        validate: {
          min: { args: [0], msg: 'Vote count cannot be negative' },
        },
      },
    },
    {
      tableName: 'sticky_notes',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return StickyNote;
};
