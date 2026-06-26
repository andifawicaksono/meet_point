const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// ── Sequelize instance ──────────────────────────────────────────────────────
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? (sql) => console.debug('[SQL]', sql) : false,
      pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
      dialectOptions:
        process.env.NODE_ENV === 'production'
          ? { ssl: { rejectUnauthorized: false } }
          : {},
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? (sql) => console.debug('[SQL]', sql) : false,
        pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
      },
    );

const db = { sequelize, Sequelize };

// ── Auto-load model files ───────────────────────────────────────────────────
const modelFiles = fs
  .readdirSync(__dirname)
  .filter((f) => f !== 'index.js' && f.endsWith('.js'));

for (const file of modelFiles) {
  const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
  db[model.name] = model;
}

// ── Associations ────────────────────────────────────────────────────────────
const { User, Room, RoomParticipant, BoardElement, StickyNote, Chat, Vote, AuditLog } = db;

// User ↔ Room (ownership)
User.hasMany(Room, { foreignKey: 'ownerId', as: 'ownedRooms', onDelete: 'CASCADE' });
Room.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

// Room ↔ RoomParticipant
Room.hasMany(RoomParticipant, { foreignKey: 'roomId', as: 'participants', onDelete: 'CASCADE' });
RoomParticipant.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// User ↔ RoomParticipant
User.hasMany(RoomParticipant, { foreignKey: 'userId', as: 'participations', onDelete: 'CASCADE' });
RoomParticipant.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Room ↔ BoardElement (one-to-one)
Room.hasOne(BoardElement, { foreignKey: 'roomId', as: 'board', onDelete: 'CASCADE' });
BoardElement.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// BoardElement → User (last editor)
BoardElement.belongsTo(User, { foreignKey: 'updatedBy', as: 'lastEditor' });

// Room ↔ StickyNote
Room.hasMany(StickyNote, { foreignKey: 'roomId', as: 'stickyNotes', onDelete: 'CASCADE' });
StickyNote.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// User ↔ StickyNote (authorship)
User.hasMany(StickyNote, { foreignKey: 'authorId', as: 'stickyNotes' });
StickyNote.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

// Room ↔ Chat
Room.hasMany(Chat, { foreignKey: 'roomId', as: 'chats', onDelete: 'CASCADE' });
Chat.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// User ↔ Chat (authorship)
User.hasMany(Chat, { foreignKey: 'authorId', as: 'chats' });
Chat.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

// Chat → Chat (self-referential reply thread)
Chat.belongsTo(Chat, { foreignKey: 'replyToId', as: 'replyTo', onDelete: 'SET NULL' });
Chat.hasMany(Chat, { foreignKey: 'replyToId', as: 'replies' });

// Room ↔ Vote
Room.hasMany(Vote, { foreignKey: 'roomId', as: 'votes', onDelete: 'CASCADE' });
Vote.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// StickyNote ↔ Vote
StickyNote.hasMany(Vote, { foreignKey: 'stickyNoteId', as: 'votes', onDelete: 'CASCADE' });
Vote.belongsTo(StickyNote, { foreignKey: 'stickyNoteId', as: 'stickyNote' });

// User ↔ Vote
User.hasMany(Vote, { foreignKey: 'voterId', as: 'votes' });
Vote.belongsTo(User, { foreignKey: 'voterId', as: 'voter' });

// User ↔ AuditLog
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Room ↔ AuditLog
Room.hasMany(AuditLog, { foreignKey: 'roomId', as: 'auditLogs' });
AuditLog.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

module.exports = db;
