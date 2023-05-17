# frozen_string_literal: true

RSpec.describe BookmarksBulkAction do
  fab!(:user) { Fabricate(:user, created_at: 1.days.ago) }
  fab!(:bookmarks) { [0..2].map { |i| Fabricate(:bookmark, user: user) } }

  it "clears reminders" do
    expect {
      changed_ids = described_class.new(user, [bookmarks.first.id], type: "clear_reminder").perform!
    }.to change { user.bookmarks.where.not(reminder_set_at: nil).count }.by(-1)
    expect(changed_ids).to eq([bookmarks.first.id])
  end

  it "deletes reminders" do
    changed_ids = []
    expect {
      changed_ids =
        described_class.new(user, [bookmarks.first.id], type: "delete_reminder").perform!
    }.to change { user.bookmarks.with_reminders.count }.by(-1)
    expect(changed_ids).to eq([bookmarks.first.id])
  end

  it "deletes bookmarks" do
    changed_ids = []
    expect {
      changed_ids = described_class.new(user, [bookmarks.first.id], type: "delete").perform!
    }.to change { user.bookmarks.count }.by(-1)
    expect(changed_ids).to eq([bookmarks.first.id])
  end
end
