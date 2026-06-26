module.exports = (sequelize, DataTypes) => {
  const BoardElement = sequelize.define(
    'BoardElement',
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
        unique: true,
        field: 'room_id',
        references: { model: 'rooms', key: 'id' },
        onDelete: 'CASCADE',
      },
      tldrawSnapshot: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        field: 'tldraw_snapshot',
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: { args: [1], msg: 'Version must be at least 1' },
        },
      },
      updatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'updated_by',
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
    },
    {
      tableName: 'board_elements',
      underscored: true,
      timestamps: false,
    },
  );

  return BoardElement;
};
