Checklists = new Mongo.Collection('checklists');

Checklists.attachSchema(new SimpleSchema({
  cardId: {
    type: String,
  },
  title: {
    type: String,
  },
  finishedAt: {
    type: Date,
    optional: true,
  },
  createdAt: {
    type: Date,
    denyUpdate: false,
    autoValue() { // eslint-disable-line consistent-return
      if (this.isInsert) {
        return new Date();
      } else {
        this.unset();
      }
    },
  },
  sort: {
    type: Number,
    decimal: true,
  },
}));

Checklists.helpers({
  itemCount() {
    return ChecklistItems.find({ checklistId: this._id }).count();
  },
  items() {
    return ChecklistItems.find(Filter.mongoSelector({
      checklistId: this._id,
    }), { sort: ['sort'] });
  },
  finishedCount() {
    return ChecklistItems.find({
      checklistId: this._id,
      isFinished: true,
    }).count();
  },
  isFinished() {
    return 0 !== this.itemCount() && this.itemCount() === this.finishedCount();
  },
  itemIndex(itemId) {
    const items = self.findOne({_id : this._id}).items;
    return _.pluck(items, '_id').indexOf(itemId);
  },
});

Checklists.allow({
  insert(userId, doc) {
    return allowIsBoardMemberByCard(userId, Cards.findOne(doc.cardId));
  },
  update(userId, doc) {
    return allowIsBoardMemberByCard(userId, Cards.findOne(doc.cardId));
  },
  remove(userId, doc) {
    return allowIsBoardMemberByCard(userId, Cards.findOne(doc.cardId));
  },
  fetch: ['userId', 'cardId'],
});

Checklists.before.insert((userId, doc) => {
  doc.createdAt = new Date();
  if (!doc.userId) {
    doc.userId = userId;
  }
});

Checklists.mutations({
  setTitle(title) {
    return { $set: { title } };
  },
});

if (Meteor.isServer) {
  Meteor.startup(() => {
    Checklists._collection._ensureIndex({ cardId: 1, createdAt: 1 });
  });

  Checklists.after.insert((userId, doc) => {
    Activities.insert({
      userId,
      activityType: 'addChecklist',
      cardId: doc.cardId,
      boardId: Cards.findOne(doc.cardId).boardId,
      checklistId: doc._id,
    });
  });

  Checklists.before.remove((userId, doc) => {
    const activities = Activities.find({ checklistId: doc._id });
    if (activities) {
      activities.forEach((activity) => {
        Activities.remove(activity._id);
      });
    }
  });
}

if (Meteor.isServer) {
  JsonRoutes.add('GET', '/api/boards/:boardId/cards/:cardId/checklists', function (req, res) {
    try {
      Authentication.checkUserId( req.userId);
      const paramCardId = req.params.cardId;
      JsonRoutes.sendResult(res, {
        code: 200,
        data: Checklists.find({ cardId: paramCardId }).map(function (doc) {
          return {
            _id: doc._id,
            title: doc.title,
          };
        }),
      });
    }
    catch (error) {
      JsonRoutes.sendResult(res, {
        code: 200,
        data: error,
      });
    }
  });

  JsonRoutes.add('GET', '/api/boards/:boardId/cards/:cardId/checklists/:checklistId', function (req, res) {
    try {
      Authentication.checkUserId( req.userId);
      const paramChecklistId = req.params.checklistId;
      const paramCardId = req.params.cardId;
      JsonRoutes.sendResult(res, {
        code: 200,
        data: Checklists.findOne({ _id: paramChecklistId, cardId: paramCardId }),
      });
    }
    catch (error) {
      JsonRoutes.sendResult(res, {
        code: 200,
        data: error,
      });
    }
  });

  JsonRoutes.add('POST', '/api/boards/:boardId/cards/:cardId/checklists', function (req, res) {
    try {
      Authentication.checkUserId( req.userId);
      const paramCardId = req.params.cardId;

      const checklistToSend = {};
      checklistToSend.cardId = paramCardId;
      checklistToSend.title = req.body.title;
      checklistToSend.items = [];
      const id = Checklists.insert(checklistToSend);
      const checklist = Checklists.findOne({_id: id});
      req.body.items.forEach(function (item) {
        checklist.addItem(item);
      }, this);


      JsonRoutes.sendResult(res, {
        code: 200,
        data: {
          _id: id,
        },
      });
    }
    catch (error) {
      JsonRoutes.sendResult(res, {
        code: 200,
        data: error,
      });
    }
  });

  JsonRoutes.add('DELETE', '/api/boards/:boardId/cards/:cardId/checklists/:checklistId', function (req, res) {
    try {
      Authentication.checkUserId( req.userId);
      const paramCommentId = req.params.commentId;
      const paramCardId = req.params.cardId;
      Checklists.remove({ _id: paramCommentId, cardId: paramCardId });
      JsonRoutes.sendResult(res, {
        code: 200,
        data: {
          _id: paramCardId,
        },
      });
    }
    catch (error) {
      JsonRoutes.sendResult(res, {
        code: 200,
        data: error,
      });
    }
  });
}
