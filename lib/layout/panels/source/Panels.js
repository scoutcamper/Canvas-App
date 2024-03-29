/**
The _enyo.Panels_ kind is designed to satisfy a variety of common use cases for
application layout. Using _enyo.Panels_, controls may be arranged as (among
other things) a carousel, a set of collapsing panels, a card stack that fades
between panels, or a grid.

Any Enyo control may be placed inside an _enyo.Panels_, but by convention we
refer to each of these controls as a "panel." From the set of panels in an
_enyo.Panels_, one is considered to be active. The active panel is set by index
using the _setIndex_ method. The actual layout of the panels typically changes
each time the active panel is set, such that the new active panel has the most
prominent position.

For more information, see the
[Panels documentation](https://github.com/enyojs/enyo/wiki/Panels) in the Enyo
Developer Guide.
*/
enyo.kind({
	name: "enyo.Panels",
	classes: "enyo-panels",
	published: {
		/**
			The index of the active panel. The layout of panels is controlled by
			the layoutKind, but as a rule, the active panel is displayed in the
			most prominent position. For example, in the (default) CardArranger
			layout, the active panel is shown and the other panels are hidden.
		*/
		index: 0,
		//* Controls whether the user can drag between panels.
		draggable: true,
		//* Controls whether the panels animate when transitioning; for example,
		//* when _setIndex_ is called.
		animate: true,
		//* Controls whether panels "wrap around" when moving past the end.
		//* The actual effect depends upon the arranger in use.
		wrap: false,
		//* Sets the arranger kind to be used for dynamic layout.
		arrangerKind: "CardArranger",
		//* By default, each panel will be sized to fit the Panels' width when
		//* the screen size is narrow enough (less than 800px). Set to false
		//* to avoid this behavior.
		narrowFit: true
	},
	events: {
		/**
			Fires at the start of a panel transition, when _setIndex_ is called
			and also during dragging.

			_inEvent.fromIndex_ contains the index of the old panel.

			_inEvent.toIndex_ contains the index of the new panel.
		*/
		onTransitionStart: "",
		/**
			Fires at the end of a panel transition, when _setIndex_ is called
			and also during dragging.

			_inEvent.fromIndex_ contains the index of the old panel.

			_inEvent.toIndex_ contains the index of the new panel.
		*/
		onTransitionFinish: ""
	},
	//* @protected
	handlers: {
		ondragstart: "dragstart",
		ondrag: "drag",
		ondragfinish: "dragfinish",
		onscroll: "domScroll"
	},
	tools: [
		{kind: "Animator", onStep: "step", onEnd: "completed"}
	],
	fraction: 0,
	create: function() {
		this.transitionPoints = [];
		this.inherited(arguments);
		this.arrangerKindChanged();
		this.narrowFitChanged();
		this.indexChanged();
	},
	rendered: function() {
		this.inherited(arguments);
		enyo.makeBubble(this, "scroll");
	},
	domScroll: function(inSender, inEvent) {
		if (this.hasNode()) {
			if (this.node.scrollLeft > 0) {
				// Reset scrollLeft position
				this.node.scrollLeft = 0;
			}
		}
	},
	initComponents: function() {
		this.createChrome(this.tools);
		this.inherited(arguments);
	},
	arrangerKindChanged: function() {
		this.setLayoutKind(this.arrangerKind);
	},
	narrowFitChanged: function() {
		this.addRemoveClass("enyo-panels-fit-narrow", this.narrowFit);
	},
	destroy: function() {
		// When the entire panels is going away, take note so we don't try and do single-panel
		// remove logic such as changing the index and reflowing when each panel is destroyed
		this.destroying = true;
		this.inherited(arguments);
	},
	removeControl: function(inControl) {
		// Skip extra work during panel destruction.
		if (this.destroying) {
			return this.inherited(arguments);
		}
		// adjust index if the current panel is being removed
		// so it's either the previous panel or the first one.
		var newIndex = -1;
		var controlIndex = enyo.indexOf(inControl, this.controls);
		if (controlIndex === this.index) {
			newIndex = Math.max(controlIndex - 1, 0);
		}
		this.inherited(arguments);
		if (newIndex !== -1 && this.controls.length > 0) {
			this.setIndex(newIndex);
			this.flow();
			this.reflow();
		}
	},
	isPanel: function() {
		// designed to be overridden in kinds derived from Panels that have
		// non-panel client controls
		return true;
	},
	flow: function() {
		this.arrangements = [];
		this.inherited(arguments);
	},
	reflow: function() {
		this.arrangements = [];
		this.inherited(arguments);
		this.refresh();
	},
	//* @public
	/**
		Returns an array of contained panels.
		Subclasses can override this if they don't want the arranger to layout all of their children
	*/
	getPanels: function() {
		var p = this.controlParent || this;
		return p.children;
	},
	//* Returns a reference to the active panel--i.e., the panel at the specified index.
	getActive: function() {
		var p$ = this.getPanels();
		//Constrain the index within the array of panels, needed if wrapping is enabled
		var index = this.index % p$.length;
		if (index < 0) {
			index += p$.length;
		}
		return p$[index];
	},
	/**
		Returns a reference to the <a href="#enyo.Animator">enyo.Animator</a>
		instance used to animate panel transitions. The Panels' animator can be used
		to set the duration of panel transitions, e.g.:

			this.getAnimator().setDuration(1000);
	*/
	getAnimator: function() {
		return this.$.animator;
	},
	/**
		Sets the active panel to the panel specified by the given index.
		Note that if the _animate_ property is set to true, the active panel
		will animate into view.
	*/
	setIndex: function(inIndex) {
		// override setIndex so that indexChanged is called
		// whether this.index has actually changed or not. Also, do
		// index clamping here.
		var prev = this.get("index");
		this.index = this.clamp(inIndex);
		this.notifyObservers("index", prev, inIndex);
	},
	/**
		Sets the active panel to the panel specified by the given index.
		Regardless of the value of the _animate_ property, the transition to the
		next panel will not animate and will be immediate.
	*/
	setIndexDirect: function(inIndex) {
		this.setIndex(inIndex);
		this.completed();
	},
	/**
		Selects the named component owned by the Panels and returns its index.
	*/
	selectPanelByName: function(name) {
		if (!name) {
			return;
		}
		var idx = 0;
		var panels = this.getPanels();
		var len = panels.length;
		for (; idx < len; ++idx) {
			if (name === panels[idx].name) {
				this.setIndex(idx);
				return idx;
			}
		}
	},
	//* Transitions to the previous panel--i.e., the panel whose index value is
	//* one less than that of the current active panel.
	previous: function() {
		var prevIndex = this.index - 1;
		if (this.wrap && prevIndex < 0) {
			prevIndex = this.getPanels().length - 1;
		}
		this.setIndex(prevIndex);
	},
	//* Transitions to the next panel--i.e., the panel whose index value is one
	//* greater than that of the current active panel.
	next: function() {
		var nextIndex = this.index+1;
		if (this.wrap && nextIndex >= this.getPanels().length) {
			nextIndex = 0;
		}
		this.setIndex(nextIndex);
	},
	//* @protected
	clamp: function(inValue) {
		var l = this.getPanels().length-1;
		if (this.wrap) {
			// FIXME: dragging makes assumptions about direction and from->start indexes.
			//return inValue < 0 ? l : (inValue > l ? 0 : inValue);
			return inValue;
		} else {
			return Math.max(0, Math.min(inValue, l));
		}
	},
	indexChanged: function(inOld) {
		this.lastIndex = inOld;
		if (!this.dragging && this.$.animator) {
			if (this.$.animator.isAnimating()) {
				this.completed();
			}
			this.$.animator.stop();
			if (this.hasNode()) {
				if (this.animate) {
					this.startTransition();
					this.$.animator.play({
						startValue: this.fraction
					});
				} else {
					this.refresh();
				}
			}
		}
	},
	step: function(inSender) {
		this.fraction = inSender.value;
		this.stepTransition();
	},
	completed: function() {
		if (this.$.animator.isAnimating()) {
			this.$.animator.stop();
		}
		this.fraction = 1;
		this.stepTransition();
		this.finishTransition();
		return true;
	},
	dragstart: function(inSender, inEvent) {
		if (this.draggable && this.layout && this.layout.canDragEvent(inEvent)) {
			inEvent.preventDefault();
			this.dragstartTransition(inEvent);
			this.dragging = true;
			this.$.animator.stop();
			return true;
		}
	},
	drag: function(inSender, inEvent) {
		if (this.dragging) {
			inEvent.preventDefault();
			this.dragTransition(inEvent);
		}
	},
	dragfinish: function(inSender, inEvent) {
		if (this.dragging) {
			this.dragging = false;
			inEvent.preventTap();
			this.dragfinishTransition(inEvent);
		}
	},
	dragstartTransition: function(inEvent) {
		if (!this.$.animator.isAnimating()) {
			var f = this.fromIndex = this.index;
			this.toIndex = f - (this.layout ? this.layout.calcDragDirection(inEvent) : 0);
		} else {
			this.verifyDragTransition(inEvent);
		}
		this.fromIndex = this.clamp(this.fromIndex);
		this.toIndex = this.clamp(this.toIndex);
		//this.log(this.fromIndex, this.toIndex);
		this.fireTransitionStart();
		if (this.layout) {
			this.layout.start();
		}
	},
	dragTransition: function(inEvent) {
		// note: for simplicity we choose to calculate the distance directly between
		// the first and last transition point.
		var d = this.layout ? this.layout.calcDrag(inEvent) : 0;
		var t$ = this.transitionPoints, s = t$[0], f = t$[t$.length-1];
		var as = this.fetchArrangement(s);
		var af = this.fetchArrangement(f);
		var dx = this.layout ? this.layout.drag(d, s, as, f, af) : 0;
		var dragFail = d && !dx;
		if (dragFail) {
			//this.log(dx, s, as, f, af);
		}
		this.fraction += dx;
		var fr = this.fraction;
		if (fr > 1 || fr < 0 || dragFail) {
			if (fr > 0 || dragFail) {
				this.dragfinishTransition(inEvent);
			}
			this.dragstartTransition(inEvent);
			this.fraction = 0;
			// FIXME: account for lost fraction
			//this.dragTransition(inEvent);
		}
		this.stepTransition();
	},
	dragfinishTransition: function(inEvent) {
		this.verifyDragTransition(inEvent);
		this.setIndex(this.toIndex);
		// note: if we're still dragging, then we're at a transition boundary
		// and should fire the finish event
		if (this.dragging) {
			this.fireTransitionFinish();
		}
	},
	verifyDragTransition: function(inEvent) {
		var d = this.layout ? this.layout.calcDragDirection(inEvent) : 0;
		var f = Math.min(this.fromIndex, this.toIndex);
		var t = Math.max(this.fromIndex, this.toIndex);
		if (d > 0) {
			var s = f;
			f = t;
			t = s;
		}
		if (f != this.fromIndex) {
			this.fraction = 1 - this.fraction;
		}
		//this.log("old", this.fromIndex, this.toIndex, "new", f, t);
		this.fromIndex = f;
		this.toIndex = t;
	},
	refresh: function() {
		if (this.$.animator && this.$.animator.isAnimating()) {
			this.$.animator.stop();
		}
		this.startTransition();
		this.fraction = 1;
		this.stepTransition();
		this.finishTransition();
	},
	startTransition: function() {
		this.fromIndex = this.fromIndex != null ? this.fromIndex : this.lastIndex || 0;
		this.toIndex = this.toIndex != null ? this.toIndex : this.index;
		//this.log(this.id, this.fromIndex, this.toIndex);
		if (this.layout) {
			this.layout.start();
		}
		this.fireTransitionStart();
	},
	finishTransition: function() {
		if (this.layout) {
			this.layout.finish();
		}
		this.transitionPoints = [];
		this.fraction = 0;
		this.fromIndex = this.toIndex = null;
		this.fireTransitionFinish();
	},
	fireTransitionStart: function() {
		var t = this.startTransitionInfo;
		if (this.hasNode() && (!t || (t.fromIndex != this.fromIndex || t.toIndex != this.toIndex))) {
			this.startTransitionInfo = {fromIndex: this.fromIndex, toIndex: this.toIndex};
			this.doTransitionStart(enyo.clone(this.startTransitionInfo));
		}
	},
	fireTransitionFinish: function() {
		var t = this.finishTransitionInfo;
		if (this.hasNode() && (!t || (t.fromIndex != this.lastIndex || t.toIndex != this.index))) {
			this.finishTransitionInfo = {fromIndex: this.lastIndex, toIndex: this.index};
			this.doTransitionFinish(enyo.clone(this.finishTransitionInfo));
		}
		this.lastIndex=this.index;
	},
	// gambit: we interpolate between arrangements as needed.
	stepTransition: function() {
		if (this.hasNode()) {
			// select correct transition points and normalize fraction.
			var t$ = this.transitionPoints;
			var r = (this.fraction || 0) * (t$.length-1);
			var i = Math.floor(r);
			r = r - i;
			var s = t$[i], f = t$[i+1];
			// get arrangements and lerp between them
			var s0 = this.fetchArrangement(s);
			var s1 = this.fetchArrangement(f);
			this.arrangement = s0 && s1 ? enyo.Panels.lerp(s0, s1, r) : (s0 || s1);
			if (this.arrangement && this.layout) {
				this.layout.flowArrangement();
			}
		}
	},
	fetchArrangement: function(inName) {
		if ((inName != null) && !this.arrangements[inName] && this.layout) {
			this.layout._arrange(inName);
			this.arrangements[inName] = this.readArrangement(this.getPanels());
		}
		return this.arrangements[inName];
	},
	readArrangement: function(inC) {
		var r = [];
		for (var i=0, c$=inC, c; (c=c$[i]); i++) {
			r.push(enyo.clone(c._arranger));
		}
		return r;
	},
	statics: {
		//* @public
		/**
			Returns true when window width is 800px or less. This value must be
			the same as the "max-width" media query used for panel sizing in
			_Panels.css_.
		*/
		isScreenNarrow: function() {
			return enyo.dom.getWindowWidth() <= 800;
		},
		//* @protected
		lerp: function(inA0, inA1, inFrac) {
			var r = [];
			for (var i=0, k$=enyo.keys(inA0), k; (k=k$[i]); i++) {
				r.push(this.lerpObject(inA0[k], inA1[k], inFrac));
			}
			return r;
		},
		lerpObject: function(inNew, inOld, inFrac) {
			var b = enyo.clone(inNew), n, o;
			// inOld might be undefined when deleting panels
			if (inOld) {
				for (var i in inNew) {
					n = inNew[i];
					o = inOld[i];
					if (n != o) {
						b[i] = n - (n - o) * inFrac;
					}
				}
			}
			return b;
		}
	}
});