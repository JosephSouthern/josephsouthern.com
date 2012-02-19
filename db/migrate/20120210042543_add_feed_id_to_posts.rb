class AddFeedIdToPosts < ActiveRecord::Migration
  def change
    add_column :posts, :feedID, :string
  end
end
