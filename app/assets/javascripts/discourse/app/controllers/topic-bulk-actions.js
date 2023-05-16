import { alias, empty } from "@ember/object/computed";
import Controller, { inject as controller } from "@ember/controller";
import I18n from "I18n";
import BulkActions from "discourse/mixins/bulk-actions";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import Topic from "discourse/models/topic";

const _buttons = [];

const alwaysTrue = () => true;

function identity() {}

function addBulkButton(action, key, opts) {
  opts = opts || {};

  const btn = {
    action,
    label: `topics.bulk.${key}`,
    icon: opts.icon,
    buttonVisible: opts.buttonVisible || alwaysTrue,
    enabledSetting: opts.enabledSetting,
    class: opts.class,
  };

  _buttons.push(btn);
}

// Default buttons
addBulkButton("showChangeCategory", "change_category", {
  icon: "pencil-alt",
  class: "btn-default",
  buttonVisible: (topics) => !topics.some((t) => t.isPrivateMessage),
});
addBulkButton("closeTopics", "close_topics", {
  icon: "lock",
  class: "btn-default",
  buttonVisible: (topics) => !topics.some((t) => t.isPrivateMessage),
});
addBulkButton("archiveTopics", "archive_topics", {
  icon: "folder",
  class: "btn-default",
  buttonVisible: (topics) => !topics.some((t) => t.isPrivateMessage),
});
addBulkButton("archiveMessages", "archive_topics", {
  icon: "folder",
  class: "btn-default",
  buttonVisible: (topics) => topics.some((t) => t.isPrivateMessage),
});
addBulkButton("moveMessagesToInbox", "move_messages_to_inbox", {
  icon: "folder",
  class: "btn-default",
  buttonVisible: (topics) => topics.some((t) => t.isPrivateMessage),
});
addBulkButton("showNotificationLevel", "notification_level", {
  icon: "d-regular",
  class: "btn-default",
});
addBulkButton("deletePostTiming", "defer", {
  icon: "circle",
  class: "btn-default",
  buttonVisible() {
    return this.currentUser.user_option.enable_defer;
  },
});
addBulkButton("unlistTopics", "unlist_topics", {
  icon: "far-eye-slash",
  class: "btn-default",
  buttonVisible: (topics) =>
    topics.some((t) => t.visible) && !topics.some((t) => t.isPrivateMessage),
});
addBulkButton("relistTopics", "relist_topics", {
  icon: "far-eye",
  class: "btn-default",
  buttonVisible: (topics) =>
    topics.some((t) => !t.visible) && !topics.some((t) => t.isPrivateMessage),
});
addBulkButton("resetBumpDateTopics", "reset_bump_dates", {
  icon: "anchor",
  class: "btn-default",
  buttonVisible() {
    return this.currentUser.canManageTopic;
  },
});
addBulkButton("showTagTopics", "change_tags", {
  icon: "tag",
  class: "btn-default",
  enabledSetting: "tagging_enabled",
  buttonVisible() {
    return this.currentUser.canManageTopic;
  },
});
addBulkButton("showAppendTagTopics", "append_tags", {
  icon: "tag",
  class: "btn-default",
  enabledSetting: "tagging_enabled",
  buttonVisible() {
    return this.currentUser.canManageTopic;
  },
});
addBulkButton("removeTags", "remove_tags", {
  icon: "tag",
  class: "btn-default",
  enabledSetting: "tagging_enabled",
  buttonVisible() {
    return this.currentUser.canManageTopic;
  },
});
addBulkButton("deleteTopics", "delete", {
  icon: "trash-alt",
  class: "btn-danger delete-topics",
  buttonVisible() {
    return this.currentUser.staff;
  },
});

// Modal for performing bulk actions on topics
export default Controller.extend(ModalFunctionality, BulkActions, {
  userPrivateMessages: controller("user-private-messages"),
  tags: null,
  emptyTags: empty("tags"),
  categoryId: alias("model.category.id"),
  isGroup: alias("userPrivateMessages.isGroup"),
  groupFilter: alias("userPrivateMessages.groupFilter"),

  onShow() {
    const topics = this.get("model.topics");
    this.set(
      "buttons",
      _buttons.filter((b) => {
        if (b.enabledSetting && !this.siteSettings[b.enabledSetting]) {
          return false;
        }
        return b.buttonVisible.call(this, topics);
      })
    );
    this.set("modal.modalClass", "topic-bulk-actions-modal small");
    this.send("changeBulkTemplate", "modal/bulk-actions-buttons");
  },

  forEachPerformed(operation, cb) {
    this.perform(this.model.topics, operation).then((topics) => {
      if (topics) {
        topics.forEach(cb);
        (this.refreshClosure || identity)();
        this.send("closeModal");
      }
    });
  },

  bulkOperation: Topic.bulkOperation,

  idsFromResults(result) {
    return result?.topic_ids;
  },

  actions: {
    showTagTopics() {
      this.set("tags", "");
      this.set("action", "changeTags");
      this.set("label", "change_tags");
      this.set("title", "choose_new_tags");
      this.send("changeBulkTemplate", "bulk-tag");
    },

    changeTags() {
      this.performAndRefresh(this.model.topics, {
        type: "change_tags",
        tags: this.tags,
      });
    },

    showAppendTagTopics() {
      this.set("tags", null);
      this.set("action", "appendTags");
      this.set("label", "append_tags");
      this.set("title", "choose_append_tags");
      this.send("changeBulkTemplate", "bulk-tag");
    },

    appendTags() {
      this.performAndRefresh(this.model.topics, {
        type: "append_tags",
        tags: this.tags,
      });
    },

    showChangeCategory() {
      this.send("changeBulkTemplate", "modal/bulk-change-category");
    },

    showNotificationLevel() {
      this.send("changeBulkTemplate", "modal/bulk-notification-level");
    },

    deleteTopics() {
      this.performAndRefresh(this.model.topics, { type: "delete" });
    },

    closeTopics() {
      this.forEachPerformed({ type: "close" }, (t) => t.set("closed", true));
    },

    archiveTopics() {
      this.forEachPerformed({ type: "archive" }, (t) =>
        t.set("archived", true)
      );
    },

    archiveMessages() {
      let params = { type: "archive_messages" };
      if (this.isGroup) {
        params.group = this.groupFilter;
      }
      this.performAndRefresh(this.model.topics, params);
    },

    moveMessagesToInbox() {
      let params = { type: "move_messages_to_inbox" };
      if (this.isGroup) {
        params.group = this.groupFilter;
      }
      this.performAndRefresh(this.model.topics, params);
    },

    unlistTopics() {
      this.forEachPerformed({ type: "unlist" }, (t) => t.set("visible", false));
    },

    relistTopics() {
      this.forEachPerformed({ type: "relist" }, (t) => t.set("visible", true));
    },

    resetBumpDateTopics() {
      this.performAndRefresh(this.model.topics, { type: "reset_bump_dates" });
    },

    changeCategory() {
      const categoryId = parseInt(this.newCategoryId, 10) || 0;

      this.perform({ type: "change_category", category_id: categoryId }).then(
        (topics) => {
          topics.forEach((t) => t.set("category_id", categoryId));
          (this.refreshClosure || identity)();
          this.send("closeModal");
        }
      );
    },

    deletePostTiming() {
      this.performAndRefresh(this.model.topics, {
        type: "destroy_post_timing",
      });
    },

    removeTags() {
      this.dialog.deleteConfirm({
        message: I18n.t("topics.bulk.confirm_remove_tags", {
          count: this.get("model.topics").length,
        }),
        didConfirm: () =>
          this.performAndRefresh(this.model.topics, { type: "remove_tags" }),
      });
    },
  },
});

export { addBulkButton };
