$(document).ready(function(){
	$("div.header_line").hoverIntent({
		over: showHeaderMenu, 
		timeout: 500, 
		out: hideHeaderMenu
	});
}); // close document.ready

var closing = false;

function showHeaderMenu(){  
							closing = false;
							var menu = $(".header_menu_move");
							menu.animate({"margin-top": "+=2em"}, 
										  "slow",
										   function(){
													if (closing == false)
												    	menu.css("z-index", "100");	
											}
					                    );
};
function hideHeaderMenu(){  
						closing = true;
	 					var menu = $(".header_menu_move");
						menu.css("z-index", -1);
						menu.animate({"margin-top": "-2em"}, 
							"slow", 
							function(){
								menu.css("z-index", -1);
							});
					};
					
