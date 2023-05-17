import Controller from "@ember/controller";
import BulkActions from "discourse/mixins/bulk-actions";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import Bookmark from "discourse/models/bookmark";

const _buttons = [];
const alwaysTrue = () => true;

function addBulkButton(action, key, opts) {
  opts = opts || {};

  const btn = {
    action,
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
  icon: "far-clock",
  class: "btn-default clear-reminder",
  buttonVisible: (bookmarks) =>
    bookmarks.some((b) => b.reminder_set_at !== null),
});

addBulkButton("deleteReminder", "delete_reminder", {
  icon: "trash-alt",
  class: "btn-default delete-reminder",
  buttonVisible: (bookmarks) => bookmarks.some((b) => b.reminder_at),
});

addBulkButton("deleteBookmark", "delete", {
  icon: "trash-alt",
  class: "btn-danger delete-bookmark",
});

// Modal for performing bulk actions on topics
export default Controller.extend(ModalFunctionality, BulkActions, {
  onShow() {
    const bookmarks = this.get("model.bookmarks");
    this.set(
      "buttons",
      _buttons.filter((b) => {
        if (b.enabledSetting && !this.siteSettings[b.enabledSetting]) {
          return false;
        }
        return b.buttonVisible.call(this, bookmarks);
      })
    );
    this.set("modal.modalClass", "topic-bulk-actions-modal small");
    this.send(
      "changeBulkTemplate",
      "modal/bulk-actions-buttons",
      "modal/bookmark-bulk-actions"
    );
  },

  bulkOperation: Bookmark.bulkOperation,

  idsFromResults(result) {
    return result?.bookmark_ids;
  },

  actions: {
    clearReminder() {
      this.performAndRefresh(this.model.bookmarks, { type: "clear_reminder" });
    },

    deleteReminder() {
      this.performAndRefresh(this.model.bookmarks, { type: "delete_reminder" });
    },

    deleteBookmark() {
      this.performAndRefresh(this.model.bookmarks, { type: "delete" });
    },
  },
});

export { addBulkButton };
