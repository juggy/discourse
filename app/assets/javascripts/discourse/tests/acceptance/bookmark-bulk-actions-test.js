import {
  acceptance,
  count,
  invisible,
  loggedInUser,
  query,
  queryAll,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import { click, triggerEvent, visit } from "@ember/test-helpers";
import bookmarkFixtures from "discourse/tests/fixtures/bookmark-fixtures";
import { test } from "qunit";
import I18n from "I18n";
import { cloneJSON } from "discourse-common/lib/object";

acceptance("Bookmark - Bulk Actions", function (needs) {
  needs.user();
  needs.pretender((server, helper) => {
    server.put("/bookmarks/bulk", () => {
      return helper.response({
        bookmark_ids: [],
      });
    });

    // load a bunch of preexisting bookmarks
    // - one without reminder
    // - one with a reminder that needs clearing
    // - one with a reminder that needs removal
    const bookmarkResponse = cloneJSON(
      bookmarkFixtures["/u/eviltrout/bookmarks.json"]
    );
    server.get("/u/eviltrout/bookmarks.json", () =>
      helper.response(bookmarkResponse)
    );
  });

  test("bulk select - modal", async function (assert) {
    // nav to the current users' bookmarks
    await visit(`/u/${loggedInUser().username}/activity/bookmarks`);

    // toggle bookmark bulk
    await click("button.bulk-select");

    // select all bookmarks
    await click(query(".bulk-select-all"));
    await click(".bulk-select-actions");

    // open the dialog and check the buttons are showing
    assert.ok(
      query("#discourse-modal-title").innerHTML.includes(
        I18n.t("bookmarks.bulk.actions")
      ),
      "it opens bulk-select modal"
    );

    assert.ok(
      query(".bulk-buttons").innerHTML.includes(
        I18n.t("bookmarks.bulk.delete")
      ),
      "it shows an option to delete bookmark"
    );

    assert.ok(
      query(".bulk-buttons").innerHTML.includes(
        I18n.t("bookmarks.bulk.clear_reminder")
      ),
      "it shows an option to clear reminder"
    );

    assert.ok(
      query(".bulk-buttons").innerHTML.includes(
        I18n.t("bookmarks.bulk.delete_reminder")
      ),
      "it shows an option to delete reminder"
    );
  });

  test("bulk select - clear reminder", async function (assert) {
    await visit(`/u/${loggedInUser().username}/activity/bookmarks`);

    await click("button.bulk-select");

    await click(query("#bulk-select-8"));

    await click(".bulk-select-actions");
    assert.ok(
      visible(".modal-body .delete-reminder"),
      "it shows delete reminder"
    );
    assert.ok(
      visible(".modal-body .delete-bookmark"),
      "it shows delete bookmarks"
    );
    await click(".modal-body .clear-reminder");

    assert.ok(
      invisible(".topic-bulk-actions-modal"),
      "it closes the bulk select modal"
    );
  });

  test("bulk select - delete reminder", async function (assert) {
    await visit(`/u/${loggedInUser().username}/activity/bookmarks`);
    await click("button.bulk-select");

    await click(query("#bulk-select-7"));

    await click(".bulk-select-actions");
    assert.ok(
      invisible(".modal-body .clear-reminder"),
      "it does not show clear reminder"
    );
    assert.ok(
      visible(".modal-body .delete-bookmark"),
      "it shows delete bookmarks"
    );
    await click(".modal-body .delete-reminder");

    assert.ok(
      invisible(".topic-bulk-actions-modal"),
      "it closes the bulk select modal"
    );
  });

  test("bulk select - delete bookmarks", async function (assert) {
    await visit(`/u/${loggedInUser().username}/activity/bookmarks`);
    await click("button.bulk-select");

    await click(query("#bulk-select-6"));

    await click(".bulk-select-actions");
    assert.ok(
      invisible(".modal-body .clear-reminder"),
      "it does not show clear reminder"
    );
    assert.ok(
      invisible(".modal-body .delete-reminder"),
      "it does not shows delete reminder"
    );

    await click(".modal-body .delete-bookmark");

    assert.ok(
      invisible(".topic-bulk-actions-modal"),
      "it closes the bulk select modal"
    );
  });

  test("bulk select - Shift click selection", async function (assert) {
    await visit(`/u/${loggedInUser().username}/activity/bookmarks`);
    await click("button.bulk-select");

    await click(queryAll("input.bulk-select")[0]);
    await triggerEvent(queryAll("input.bulk-select")[2], "click", {
      shiftKey: true,
    });
    assert.strictEqual(
      count("input.bulk-select:checked"),
      3,
      "Shift click selects a range"
    );

    await click("button.bulk-clear-all");

    await click(queryAll("input.bulk-select")[2]);
    await triggerEvent(queryAll("input.bulk-select")[0], "click", {
      shiftKey: true,
    });
    assert.strictEqual(
      count("input.bulk-select:checked"),
      3,
      "Bottom-up Shift click range selection works"
    );
  });

  test("bulk actions in chunks", async function (assert) {
    // set chunk size to a lower value
    const controller = this.container.lookup(
      "controller:bookmark-bulk-actions"
    );
    controller.set("chunkSize", 2);

    let oldBulk = controller.bulkOperation,
      bulkCalls = 0;
    controller.bulkOperation = async function (items, operation) {
      bulkCalls++;
      return oldBulk(items, operation);
    };

    // go to the page and select all
    await visit(`/u/${loggedInUser().username}/activity/bookmarks`);
    await click("button.bulk-select");

    await click(query(".bulk-select-all"));

    await click(".bulk-select-actions");
    await click(".modal-body .delete-bookmark");

    // this should trigger 4 calls to the bulk endpoint
    assert.ok(bulkCalls === 5, "has made bulk calls");
  });
});
