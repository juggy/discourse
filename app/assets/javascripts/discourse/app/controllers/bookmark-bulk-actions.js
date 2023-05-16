import { alias, empty } from "@ember/object/computed";
import Controller, { inject as controller } from "@ember/controller";
import I18n from "I18n";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { Promise } from "rsvp";
import Topic from "discourse/models/topic";

import { inject as service } from "@ember/service";

const _buttons = [];
const alwaysTrue = () => true;
function identity() {}

function addBulkButton(actionToCall, key, opts) {
  opts = opts || {};

  const btn = {
    actionToCall,
    label: `bookmarks.bulk.${key}`,
    icon: opts.icon,
    buttonVisible: opts.buttonVisible || alwaysTrue,
    enabledSetting: opts.enabledSetting,
    class: opts.class,
  };

  _buttons.push(btn);
}

// Default buttons
addBulkButton("clearReminder", "clear_reminder", {
  icon: "bookmark",
  class: "btn-default",
  buttonVisible: (bookmarks) => bookmarks.some((b) => b.reminder_at),
});
addBulkButton("deleteBookmark", "delete_bookmark", {
  icon: "bookmark",
  class: "btn-default",
  buttonVisible: true
});

// Modal for performing bulk actions on topics
export default Controller.extend(ModalFunctionality, {
  userPrivateMessages: controller("user-private-messages"),
  dialog: service(),
  tags: null,
  emptyTags: empty("tags"),
  categoryId: alias("model.category.id"),
  processedTopicCount: 0,
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

  perform(operation) {
    this.set("processedTopicCount", 0);
    if (this.get("model.topics").length > 20) {
      this.send("changeBulkTemplate", "modal/bulk-progress");
    }

    this.set("loading", true);

    return this._processChunks(operation)
      .catch(() => {
        this.dialog.alert(I18n.t("generic_error"));
      })
      .finally(() => {
        this.set("loading", false);
      });
  },

  _generateTopicChunks(allTopics) {
    let startIndex = 0;
    const chunkSize = 30;
    const chunks = [];

    while (startIndex < allTopics.length) {
      let topics = allTopics.slice(startIndex, startIndex + chunkSize);
      chunks.push(topics);
      startIndex += chunkSize;
    }

    return chunks;
  },

  _processChunks(operation) {
    const allTopics = this.get("model.topics");
    const topicChunks = this._generateTopicChunks(allTopics);
    const topicIds = [];

    const tasks = topicChunks.map((topics) => () => {
      return Topic.bulkOperation(topics, operation).then((result) => {
        this.set(
          "processedTopicCount",
          this.get("processedTopicCount") + topics.length
        );
        return result;
      });
    });

    return new Promise((resolve, reject) => {
      const resolveNextTask = () => {
        if (tasks.length === 0) {
          const topics = topicIds.map((id) => allTopics.findBy("id", id));
          return resolve(topics);
        }

        tasks
          .shift()()
          .then((result) => {
            if (result && result.topic_ids) {
              topicIds.push(...result.topic_ids);
            }
            resolveNextTask();
          })
          .catch(reject);
      };

      resolveNextTask();
    });
  },

  performAndRefresh(operation) {
    return this.perform(operation).then(() => {
      (this.refreshClosure || identity)();
      this.send("closeModal");
    });
  },

  actions: {
    clearReminder(){
      alert("clear");
    },

    deleteBookmark(){
      alert("delete");
    }
  }
});

export { addBulkButton };
