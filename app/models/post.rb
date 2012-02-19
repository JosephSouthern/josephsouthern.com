class Post < ActiveRecord::Base
  extend FriendlyId
  friendly_id :title, :use => [:slugged, :history]
  
 # validates :name,  :presence => true
#  validates :title, :presence => true,
#            :length => { :minimum => 5 }x

end
