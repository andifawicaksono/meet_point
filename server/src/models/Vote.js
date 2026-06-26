module.exports = (sequelize, DataTypes) => {
  const Vote = sequelize.define(
    'Vote',
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
      stickyNoteId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'sticky_note_id',
        references: { model: 'sticky_notes', key: 'id' },
        onDelete: 'CASCADE',
      },
      voterId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'voter_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      stars: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: { args: [1], msg: 'Stars must be at least 1' },
          max: { args: [5], msg: 'Stars cannot exceed 5' },
          isInt: { msg: 'Stars must be an integer' },
        },
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
    },
    {
      tableName: 'votes',
      underscored: true,
      timestamps: false,
      indexes: [
        { unique: true, fields: ['sticky_note_id', 'voter_id'] },
      ],
    },
  );

  return Vote;
};
