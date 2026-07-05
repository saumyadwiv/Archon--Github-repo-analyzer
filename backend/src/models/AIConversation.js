const mongoose = require('mongoose');

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    // Optional context reference, e.g. which file this message concerns (for "explain this file")
    contextFilePath: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiConversationSchema = new Schema(
  {
    repository: { type: Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: ['chat', 'file_explain', 'readme_generate', 'cycle_explain'], default: 'chat' },
    title: { type: String, default: 'New conversation' },

    messages: [messageSchema],

    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

aiConversationSchema.index({ repository: 1, user: 1, lastMessageAt: -1 });

module.exports = mongoose.model('AIConversation', aiConversationSchema);
