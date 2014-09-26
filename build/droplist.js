/*
combined files : 

kg/droplist/2.0.1/datalist
kg/droplist/2.0.1/viewscroll
kg/droplist/2.0.1/droplist

*/
/**
 * 默认，单页scroll式的数据。
 * 初次异步获取数据，或直接使用数据源或每次都异步获取数据。
 */
KISSY.add('kg/droplist/2.0.1/datalist',function(S, require, exports, module) {
    var UNIQUEKEY = "__id",
        QUEUEINDEX = '__index',
        def = {
            dataSource: null
        };
    function DataList() {
        this._init.apply(this, arguments);
    }

    S.augment(DataList, S.EventTarget, {
        _init: function(cfg) {
            cfg = this.cfg = S.merge(def, cfg);
            this.cache = {};
            this._dataMap = {};
            this._initSelected = cfg.selected;
            this.mulSelect = cfg.mulSelect;
        },
        getDataByValue: function(value) {
            if(!this.getDataSource()) {
                return;
            }
            var result;
            S.each(this.getDataSource(), function(it) {
                if(it.value === value) {
                    result = it;
                    return false;
                }
            });
            return result;
        },
        getClientId: function(data) {
            return data && data[UNIQUEKEY];
        },
        getDataByText: function(text) {
            if(!this.getDataSource()) {
                return;
            }
            var result;
            S.each(this.getDataSource(), function(it) {
                if(it.text === text) {
                    result = it;
                    return false;
                }
            });
            return result;
        },
        select: function(id) {
            var data = id;
            if(!S.isPlainObject(id) && id != undefined) {
                data = this._dataMap[id];
            }
            this._selectByData(data);
        },
        _selectByData: function(data) {
            if(this.mulSelect){
                if(this.selected && data && S.inArray(data,this.selected)) return;
            }else{
                // 同一个选项，就不需要再次处理了。
                if(this.selected && data && data.value === this.selected.value) return;
            }
            this.fire('selected', {data:data});
        },
        saveData: function(data){
            if(this.mulSelect){
                this.selected = this.selected || [];
                this.selected.push(data);
            }else{
                this.selected = data;
            }
            // console.log(this.selected);
        },
        delData:function(id){
            for (var i = 0; i < this.selected.length; i++) {
                if(this.selected[i].__id == id){
                    this.selected.splice(i,1);
                    break;
                }
            };
        },
        getSelectedData: function() {
            return this.selected || this._initSelected;
        },
        setDataSource: function(kw, data) {
            this.cache[kw] = data;
            this._list = data;
        },
        getDataSource: function(kw) {
            kw = kw || "";
            return this.cache[kw];
        },
        // 根据新数据，重新构造数据。
        dataFactory: function(list) {
            var self = this,
                prevSelected = self.getSelectedData(),
                result = [],
                map = this._dataMap;

            self.selected = undefined;

            S.each(list, function(it, idx) {
                var _id = S.guid();
    //                if(it[UNIQUEKEY] === undefined) {
                    it[UNIQUEKEY] = _id;
    //                }

                it[QUEUEINDEX] = idx;
                map[_id] = it;
                result.push(it);

                // 匹配新数据中的选择项
                // 模拟原生select，只以value值为准即可。
                if(self.cfg.mulSelect){
                    if(prevSelected && prevSelected.length){
                        for (var i = 0; i < prevSelected.length; i++) {
                            if(prevSelected[i] && it.value == prevSelected[i].value) {
                                self.select(_id);
                                break;
                            }
                        }
                    }
                }else{
                    if(prevSelected && it.value == prevSelected.value) {
                        self.select(_id);
                    }
                }
            });

            delete self._initSelected;

            return result;
        }
    });

    module.exports = DataList;
});
/**
 * 单页 scroll式的浮层。没有分页，没有分组。
 */
KISSY.add('kg/droplist/2.0.1/viewscroll',['dom', 'event', 'overlay', 'kg/lap/0.0.1/'], function(S, require, exports, module) {
    var D = require('dom'),
        E = require('event'),
        Overlay = require('overlay'),
        Lap = require('kg/lap/0.0.1/');

    var EMPTY = "",
        TEMPLATES = {
            selectedCls: "selected",
            focusCls: "focus",
            prefixId: "dropmenu-",
            prefixCls: "dropmenu-",
            menuItem: '<li class="{prefixCls}item" id="{prefixId}item{__id}" data-id="{__id}">{text}</li>',
            empty: "搜索无结果"
        },
        def = {
            format: function(data) {
                return data;
            }
        };

    function View() {
        this._init.apply(this, arguments);
    }

    S.augment(View, S.EventTarget, {
        _init: function(datalist, config) {
            var self = this,
                cfg = S.merge(def, config),
                layer = new Overlay({
                    prefixCls: TEMPLATES.prefixCls
                });

            self.layer = layer;
            self.elList = D.create('<ul></ul>')
            self.datalist = datalist;
            self.format = cfg.format;
            self.mulSelect = cfg.mulSelect;

            layer.on('afterRenderUI', function() {
                self._UIRender();
            });

            this.on('hide', function() {
                self.focused = undefined;
            })
        },
        _UIRender: function() {
            var self = this,
                layer = self.layer,
                elList = self.elList;

            var elWrap = layer.get('el'),
                elContent = layer.get('contentEl');

            elContent.append(elList);

            self._bindList();

            /**
             * @public 在渲染列表容器的时候触发。droplist对象用来进行焦点控制。
             * @requires this.elWrap this.fire('UIRender');
             */
            self.elWrap = elWrap;
            self.elWrap.attr('id', TEMPLATES.prefixId + 'wrap' + S.guid());
            self.fire('UIRender');
        },
        emptyRender: function(html) {
            this._list = [];
            D.html(this.elList, html || TEMPLATES.empty);
        },
        /**
         * @public 渲染指定的数据
         * TODO 完善+限定高度的渲染。
         * @param list
         */
        render: function(list) {
            var self = this,
                lap = self.lap,
                fragment = document.createDocumentFragment();

            lap && lap.stop();

            // self.lap变量在这里指向的对象可能在lap.stop()方法执行后被改变了。
            // 而变量lap还是指向原有的lap对象的，所以这里应该以self.lap来做判断。
            if(self.lap) {
                S.later(function() {
                    self.render(list);
                }, 20);
                return true;
            }
            D.html(self.elList, EMPTY);
            lap = self.lap = Lap(list, {duration: 30});
            self._list = list;
            // 每一条记录的事件响应
            lap.handle(function(item, globalIndex) {
                var elItem = self._itemRender(item);
                elItem && fragment.appendChild(elItem);
            });

            // 每一批次数据的事件响应
            lap.batch(function() {
                D.append(fragment, self.elList);
            });

            // 数据完成以后的事件响应。
            lap.then(function() {
                D.append(fragment, self.elList);
                self.lap = null;
            });
            lap.start();
        },
        _itemRender: function(data) {
            if(!data) return null;

            var _data = this.format(S.clone(data)),
                html = S.substitute(TEMPLATES.menuItem, S.merge({
                    prefixId: TEMPLATES.prefixId,
                    prefixCls: TEMPLATES.prefixCls
                }, _data)),
                el = D.create(html),
                selected = this.datalist.getSelectedData();

            if(this.mulSelect){
                if(selected && S.inArray(data, selected)) {
                    this._selectByElement(el, data);
                }
            }else{
                if(selected && selected.value === data.value) {
                    this._selectByElement(el, data);
                }
            }
            return el;
        },
        _bindList: function() {
            var self = this,
                elList = self.elList;

            E.on(elList, 'click', function(ev) {
                var target = ev.target,
                    itemCls = TEMPLATES.prefixCls + "item";
                if(!D.hasClass(target, itemCls)) {
                    target = D.parent(target, itemCls);
                }

                if(!target) return;
                ev.stopPropagation();

                var _id = D.attr(target, 'data-id');
                self.fire('itemSelect', {id: _id})
            });
        },
        /**
         * @public 根据data._id获取元素，选择指定的元素。若不存在，则取消选择
         * @param data
         */
        select: function(data) {
            var elItem = this.getElement(data);
            if(!elItem) {
                elItem = data = undefined;
            }
            this._selectByElement(elItem, data);
            this.fire('select', {data: data});
        },
        /**
         * @public 根据clientId 聚焦指定的元素。若不存在，则取消聚焦
         * @param id
         */
        _focus: function(data) {
            var elItem = this.getElement(data);

            // TODO 列表未渲染出来时如何处理？
            if(!elItem) {
                elItem = data = undefined;
            }
            this._setElementClass(elItem, this.focused, TEMPLATES.focusCls,true);
            this.focused = data;
            this.scrollIntoView(data);
            if(this.mulSelect && this.datalist.selected && data && S.inArray(data,this.datalist.selected)) return;
            this.fire('focus', {data: data});
        },
        _selectByElement: function(elItem, data) {
            this._setElementClass(elItem, this.datalist.selected, TEMPLATES.selectedCls);
            this.focused = data;
        },
        _setElementClass: function(el, data, cls, isfocus) {
            if(data && !this.mulSelect || isfocus) {
                var elItem = this.getElement(data);
                elItem && D.removeClass(elItem, cls);
            }
            el && D.addClass(el, cls);
        },
        focusNext: function() {
            var self = this,
                focused = this.focused,
                newFocus;
            if(focused) {
                var index = 0;
                S.each(this._list, function(item, idx) {
                    if(item.value == focused.value) {
                        index = idx;
                        return false;
                    }
                });
                if(this.mulSelect){
                    toNewFocus(index+1);
                }else{
                    newFocus = this._list[index + 1];
                }
            }else {
                toNewFocus(0);
            }
            this._focus(newFocus);
            function toNewFocus(_index){
                var i = self._list.length - _index + 1;
                while(i--){
                    if(!self.datalist.selected || !S.inArray(self._list[self._list.length - i], self.datalist.selected)){
                        newFocus = self._list[self._list.length - i];
                        break;
                    };
                }
            }
        },
        focusPrevious: function() {
            var self = this,
                focused = this.focused,
                newFocus;
            if(focused) {
                var index = 0;
                S.each(this._list, function(item, idx) {
                    if(item.value == focused.value) {
                        index = idx;
                        return false;
                    }
                });
                if(this.mulSelect){
                    toNewFocus(index-1);
                }else{
                    newFocus = this._list[index - 1];
                }
            }else {
                toNewFocus(this._list.length-1);
            }
            this._focus(newFocus);
            function toNewFocus(index){
                index++;
                while(index--){
                    if(!self.datalist.selected || !S.inArray(self._list[index], self.datalist.selected)){
                        newFocus = self._list[index];
                        break;
                    };
                }
            }
        },
        selectFocused: function() {
            // 通过事件触发，而不是直接调用view的方法触发。
            // 因为对整个组件来说，选择操作除了表现层的改变，还有datalist数据层的处理。
            // 若focus为空的时候，并不等于取消选择。保持选择即可。
            if(this.focused) {
                this.fire('itemSelect', {id: this.datalist.getClientId(this.focused)});
            }
        },
        /**
         * @public 显示和隐藏
         * @param isVisible
         */
        visible: function(visible) {
            var isVisible = this.getVisible(),
                willVisible = visible === undefined ? !isVisible : visible;

            if(isVisible === willVisible) return;

            if(willVisible) {
                this.layer.show();
                this.fire('show');
            }else {
                this.layer.hide();
                this.fire('hide');
            }
        },
        destroy: function(){
            this.layer.destroy();
        },
        getVisible: function() {
            return this.layer.get('visible');
        },
        /**
         * @public 浮层的定位。按照overlay的align定义。
         * @param align
         */
        align: function(align) {
            this.layer.set('align', align);
        },
        getElement: function(data) {
            var id = this.datalist.getClientId(data);
            if(id) {
                return D.get('#' + TEMPLATES.prefixId + "item" + id, this.elList);
            }else {
                return;
            }
        },
        /**
         * 指定项显示在当前可视视图内
         */
        scrollIntoView: function(data) {
            var elItem = this.getElement(data);
            D.scrollIntoView(elItem, this.elWrap);
        }
    });

    module.exports = View;
});
/**
 * @fileoverview
 * @author wuake<ake.wgk@taobao.com>
 * @module droplist
 **/

/**
 * 选择操作的执行路径
 * A: view.event.itemSelect
 * B: datalist.select()
 * C: droplist.event.change
 * D: droplist.elInput.event.blur
 * E: droplist.elInput.event.keyup (输入内容/搜索)
 * F: droplist.elInput.event.keydown (回车选择)
 * G: view.elWrap.event.click (鼠标选择)
 *
 * 1. G -> A -> B -> C
 * 2. D -> C
 * 3. E -> C
 * 4. F -> A -> B -> C
 */
KISSY.add('kg/droplist/2.0.1/droplist',['dom', 'event', 'ajax', './datalist', './viewscroll'], function(S, require, exports, module) {
    var D = require('dom'),
        E = require('event'),
        IO = require('ajax'),
        DataList = require('./datalist'),
        View = require('./viewscroll');

    var supportPlaceholder = "placeholder" in document.createElement("input");

    var EMPTY = '',
        fnNoop = function() {},
        def = {
            hideDelay: 100,
            droplistCls: "",
            fieldName: "",
            inputName: "",
            ariaLabel: "",
            // droplist容器的append处理逻辑
            insertion: document.body,
            placeholder: "",
            freedom: false,
            // 若非undefined，则直接用customValue作为自定义内容的value值。
            // 若是undefined，则用当前输入框的值作为自定义内容的value
            // freedom配置为true时有效。
            customData: undefined,
            autoMatch: true,
            mulSelect: false,  //是否多选
    //            emptyFormat: function(query) {return "没有搜索结果"},
            // format: function(data) {return data;},
            fnDataAdapter: function(data) {
                return data;
            },
            fnReceive: function(data) {
                return data;
            }
        },
        TEMPLATES = {
            wrap: ['<div class="droplist {isMultiple} {droplistCls}">' +
                '<div class="drop-trigger"><i class="caret"></i></div>' +
                '<div class="drop-wrap">',
                supportPlaceholder ? undefined : '<label class="drop-placeholder">{placeholder}</label>',
                '<input class="drop-text" type="text" placeholder="{placeholder}" />' +
                '</div>' +
                '<input class="drop-value" type="hidden" />' +
            '</div>'].join(EMPTY),
            textCls: "drop-text",
            valueCls: "drop-value",
            triggerCls: "drop-trigger",
            placeholderCls: 'drop-placeholder'
        },
        // no operation key code
        opKeyCode = [
            9, // tab
            13,// enter
            16,// shift
            17,// ctrl
            18,// alt
            20,// caps lock
            27,// esc
            33,// page up
            34,// page down
            35,// end
            36,// home
            37,// left arrow
            38,// up arrow
            39,// right arrow
            40,// down arrow
            45,// insert
            91,// left window/command key
            93 // right window/command key
        ];
    var ACTIVEDESCENDANT = 'aria-activedescendant',
    ARIA = {
        bind: function(instance, label) {
            var listbox = instance._view,
                elInput = instance.elText;

            D.attr(instance.elWrap, {
                "role": 'combobox'
            });
            D.attr(elInput, {
                "role": "textbox"
            });
            D.attr(elInput, {
                "aria-autocomplete": "list",
                "aria-haspopup": "true",
                "aria-label": label
            });

            instance.on('hide show', function(ev) {
                D.attr(elInput, 'aria-expanded', ev.type === 'show');
            });

            listbox.on('UIRender', function(ev) {
                var elWrap = listbox.elWrap;
                D.attr(elInput, {
                    "aria-owns": elWrap[0].id
                });

                listbox.on('focus', function(ev) {
                    var data = ev.data,
                        el = listbox.getElement(data);

                    elWrap.attr(ACTIVEDESCENDANT, el ? el.id : EMPTY);
                });
            });

            instance.on('change', function() {
                D.attr(listbox.elWrap, ACTIVEDESCENDANT, EMPTY);
            });
        }
    };

    /**
     *
     * @class DropList
     * @constructor
     * @extends Base
     */
    function DropList() {

        this._init.apply(this, arguments);
    }
    S.augment(DropList, S.EventTarget, /** @lends DropList.prototype*/{
        _init: function(config) {
            var cfg = S.merge(def, config);
            this.cfg = cfg;

            if(cfg.srcNode) {
                this._buildWrap(cfg.srcNode);
            }

            this._data = new DataList({
                selected: cfg.selectedItem,
                mulSelect: cfg.mulSelect
            });

            this._view = new View(this._data, {
                format: cfg.format,
                mulSelect: cfg.mulSelect
            });

            this._bindControl();

            this._timer = {
                hide: null
            };

            this._matchMap = {};
        },
        // 渲染结构以及事件绑定等等
        render: function() {
            var self = this,
                cfg = self.cfg,
                elWrap = self.elWrap,
                datalist = self._data;

            if(!elWrap) {
                self._buildWrap();
                elWrap = self.elWrap;
                elTrigger = self.elTrigger;
            }

            if(!D.parent(elWrap)) {
                var insertion = cfg.insertion;
                if(S.isFunction(insertion)) {
                    insertion(elWrap);
                }else if(insertion.appendChild){
                    insertion.appendChild(elWrap);
                }else if(S.isString(insertion)) {
                    insertion = D.get(insertion);
                    if(insertion && insertion.appendChild) {
                        insertion.appendChild(elWrap);
                    }
                }
                //如果是复选，移除elTrigger
                cfg.mulSelect && elTrigger && D.remove(elTrigger);
            }

            this._bindElement();

            // 在数据初始化之前绑定
            ARIA.bind(this, cfg.ariaLabel);

            // render时才做初始化数据处理。
            var ds = cfg.dataSource;

            function setDataSource(data) {
                // 预处理数据
                var dt = self._dataFactory(data);
                // 缓存数据
                datalist.setDataSource("", dt);
            }

            if(S.isArray(ds)) {

                setDataSource(ds)

            }else if(S.isString(ds)) {

                this._fetch({
                    url: ds
                }, function(data) {

                    setDataSource(data);
                });

            }else if(S.isPlainObject(ds)) {

                this._fetch(ds, function(data) {

                    setDataSource(data);
                });

            }else if(S.isFunction(ds)) {

                ds(function(data) {

                    setDataSource(data);
                });

            }
        },
        /**
         * 设置匹配到一个值或不匹配时对应的处理函数。
         * @param value <String> 用来匹配的值
         * @param fnMatch <Function> 若当前选择项的值与参数value一致，则执行该函数。
         * @param fnMismatch <Function> 若当前选择项的值与参数value不一致，则执行该函数。
         */
        doWith: function(value, fnMatch, fnMismatch) {
            var self = this;

            var map = self._grepMethods(value, fnMatch, fnMismatch);

            // 设置的时候，根据当前选择的项立即执行一次。
            self._runWithMatch(map, value, self.getSelectedData());
        },
        _grepMethods: function(value, fnMatch, fnMismatch) {
            var self = this,
                map = self._matchMap[value];

            if(!map) {
                map = self._matchMap[value] = {
                    match: [],
                    mismatch: []
                };
            }

            var match = self._mergeMethods(map.match, fnMatch),
                mismatch = self._mergeMethods(map.mismatch, fnMismatch);

            return {
                match: match,
                mismatch: mismatch
            };
        },
        _mergeMethods: function(queue, fns) {
            var rt = [];
            S.each(S.makeArray(fns), function(fn) {
                if(!S.inArray(fn, queue)) {
                    queue.push(fn);
                    rt.push(fn);
                }
            });

            return rt;
        },
        removeMatch: function(value) {
            var map = this._matchMap[value];

            if(map) {
                map.match.length = 0;
                map.mismatch.length = 0;
            }
        },
        // 程序调用的选择操作，是从droplist对象中触发的。
        selectByValue: function(value) {
            var datalist = this._data,
                data = datalist.getDataByValue(value);

            // 如果设置的是undefined，表示要取消选择
            // 如果是因为搜索的结果为空，则设置为customData
            if(value !== undefined &&
                !data && this.cfg.freedom) {

                data = this.getCustomData();
            }

            datalist.select(data);
        },
        // 通过data来设置
        selectByData: function(data) {
            var datalist = this._data,
                dt = data ? datalist.getDataByValue(data.value) : undefined;

            // 如果不是列表的有效数据，则需要判断配置是否支持自定义的数据。
            // 支持的情况下才用传进来的自定义数据，否则还是设置为未选择。
            if(data !== undefined &&
                !dt && this.cfg.freedom) {

                dt = data;
            }

            datalist.select(dt);
        },
        getSelectedData: function() {
            return this._data.getSelectedData();
        },
        getCustomData: function() {
            var custom = this.cfg.customData || {},
                data = {};

            data.text = custom.text !== undefined ? custom.text : this.elText.value;

            data.value = custom.value !== undefined ? custom.value : data.text;

            return data;
        },
        hide: function() {
            var view = this._view;
            view && view.visible(false);
            this.fire("hide");
        },
        show: function() {
            var view = this._view,
                elWrap = this.elWrap;

            view.align({
                node: elWrap,
                points: ['bl','tl'],
                offset: [0, 0]
            });
            view.visible(true);
            this.fire("show");
        },
        destroy: function() {
            this.fire("destroy");
            D.remove(this.elWrap);
            this._view.destroy();
            this._view = null;
            this._data = null;
        },
        /**
         * 数据预处理
         * @param data
         * @returns {*}
         * @private
         */
        _dataFactory: function(data) {
            var dt = this.cfg.fnDataAdapter(data);
            return this._data.dataFactory(dt);
        },
        _bindControl: function() {
            var self = this,
                view = this._view,
                datalist = this._data;

            view.on('UIRender', function(ev) {
                var elWrap = view.elWrap;
                // 设置列表浮层不可选择。使得点击操作不会获取焦点。
                D.unselectable(elWrap);
                // chrome和firefox下，还需要阻止掉mousedown默认事件。
                E.on(elWrap, 'mousedown', function(ev) {
                    ev.preventDefault();
                });
            });

            // 列表的鼠标点击操作和键盘回车选择操作是从view对象中触发的。
            view.on('itemSelect', function(ev) {
                self._data.select(ev.id);
            });

            // 键盘聚焦项操作
            view.on('focus', function(ev) {
                // 将当前聚焦项填充到输入框中
                if(self.cfg.mulSelect) {
                    self.elText.value = ev.data? ev.data.text : '';
                }else{
                    self._fillText(ev.data || self.getSelectedData());
                }
            });

            // 初始化的选择是从datalist中触发的。
            datalist.on('selected', function(ev) {
                // 所以要联动view层的操作
                view.select(ev.data);
                self._fillText(ev.data);
                datalist.saveData(ev.data);
                self.fire('change', {data: ev.data, value:self.getValue()});
                // 选择操作完成以后，默认关闭浮层。
                self.hide();
            });

            // doWith注册的逻辑处理
            self.on('change', function(ev) {
                var map = self._matchMap;
                S.each(map, function(d, v) {
                    self._runWithMatch(d, v, ev.data);
                });
            });
        },
        _buildWrap: function(elWrap) {
            var cfg = this.cfg;
            elWrap = D.get(elWrap);

            if(!elWrap) {
                var html = S.substitute(TEMPLATES.wrap, {
                    isMultiple: cfg.mulSelect?'droplist-multiple':'',
                    droplistCls: cfg.droplistCls?cfg.droplistCls:'',
                    placeholder: cfg.placeholder
                });
                elWrap = D.create(html);
            }

            var elTrigger = D.get('.' + TEMPLATES.triggerCls, elWrap),
                elText = D.get('.' + TEMPLATES.textCls, elWrap),
                elValue = D.get('.' + TEMPLATES.valueCls, elWrap),
                elPlaceholder = D.get('.' + TEMPLATES.placeholderCls, elWrap),
                fieldName = cfg.fieldName,
                inputName = cfg.inputName || fieldName + "-text";

            // 设置value表单域的name值
            if(fieldName) {
                D.attr(elValue, 'name', fieldName);
                D.attr(elText, 'name', inputName);
            }
            this.elPlaceholder = elPlaceholder;
            this.elWrap = elWrap;
            this.elValue = elValue;
            this.elText = elText;
            this.elTrigger = elTrigger;
        },
        _bindElement: function() {
            var self = this,
                cfg = this.cfg,
                elText = this.elText,
                elValue = this.elValue,
                view = self._view,
                datalist = self._data;

            E.on(this.elTrigger, 'click', function(ev) {
                E.fire(elText, 'focus');
            });

            D.unselectable(this.elTrigger);

            // 同步数据用。
            elValue && self.on('change', function(ev) {
                var selected = self.getSelectedData();
                elValue.value = self.getValue();
            });

            // 模拟placeholder的功能
            var elPlaceholder = this.elPlaceholder;
            !supportPlaceholder && E.on(elText, 'valuechange', function(ev) {
                var val = D.val(elText);
                if(S.trim(val) === "") {
                    D.show(elPlaceholder);
                }else {
                    D.hide(elPlaceholder);
                }
            });
            self._bindInput(elText);
        },
        _bindInput: function(elInput) {
            var self = this,
                elText = this.elText,
                cfg = self.cfg,
                datalist = self._data,
                view = self._view;

            E.on(elInput, 'click', function(){
                var isVisible = self._view.getVisible();
                if(!isVisible) E.fire(elText, 'focus');
            });
            E.on(elInput, 'focus', function(){
                var isVisible = self._view.getVisible();
                self._stopHideTimer();
                if(!isVisible) {
                    view.render(datalist.getDataSource());
                    self.show();
                }else {
                    self.hide();
                }
            });

            E.on(elInput, 'blur', function() {
                var inputText = elInput.value,
                    data;
                // 在失去焦点的时候，自动匹配当前输入值相同的项。
                if(cfg.autoMatch) {
                    data = self._autoMatchByText(inputText);
                    if(data && self.getSelectedData() && S.inArray(data, self.getSelectedData())){
                        data = undefined;
                    }
                }
                // 若当前没有选择或匹配的项，且支持自定义输入内容，且输入的内容不为空
                // 则设置一个默认的值，这个值不记录到程序中。只是显示和同步数据。
                if(!cfg.mulSelect && data === undefined && cfg.freedom && inputText !== EMPTY) {
                    data = self.getCustomData();
                }
                // 因为聚焦时会填充聚焦项的内容。失去焦点的时候需要重新设置为选择项的内容。
                if(data){
                    self._data.select(data);
                }else{
                    self._fillText(null);
                    self.fire('change', {data: undefined, value:self.getValue()});
                }
                self._latencyHide();
            });

            // keydown时检测操作
            E.on(elInput, 'keydown', function(ev) {
                var keyCode = ev.keyCode;

                // esc & tab
                if(keyCode == 9 || keyCode == 27) {
                    self.hide();
                    return;
                }

                // 上下键操作
                if(keyCode == 38 || keyCode == 40) {
                    ev.preventDefault();

                    if(!self._view.getVisible()) {
                        view.render(datalist.getDataSource());
                        self.show();
                        return;
                    }

                    if(keyCode === 40) {
                        view.focusNext();
                    }else {
                        view.focusPrevious();
                    }
                    return;
                }

                // 回车操作
                if(keyCode == 13) {
                    // 表单里面，输入框的回车默认触发表单提交。阻止掉
                    ev.preventDefault();
                    view.selectFocused();
                }

            });

            // keyup 进行搜索和输入操作
            E.on(elInput, 'keyup', function(ev) {
                var keyCode = ev.keyCode;
                // 空操作，如home/end等键的响应。
                if(S.inArray(keyCode, opKeyCode)
                    || keyCode >= 112 && keyCode <= 123) {
                    return;
                }

                // 其他有效输入

                // 如果值为空，则显示完整的列表
                var kw = elInput.value;
                if(!kw) {
                    view.render(datalist.getDataSource());
                    self.show();
                    return;
                }

                function render(list) {
                    if(!cfg.mulSelect){
                        var prevData = self.getSelectedData();
                        datalist.selected = undefined;
                        // 但是若数据变化了，还是需要触发外部事件，便于响应处理
                        if(prevData !== undefined) {
                            self.fire('change', {data: undefined, value:self.getValue()});
                        }
                    }
                    view.focused = undefined;
                    if(list.length === 0) {
                        var html = "";
                        if(S.isFunction(cfg.emptyFormat)) {
                            html = cfg.emptyFormat(kw);
                        }else if(S.isString(cfg.emptyFormat)) {
                            html = cfg.emptyFormat;
                        }
                        view.emptyRender(html);
                    }else {
                        view.render(list);
                    }
                    self.show();
                }
                if(cfg.remote) {
                    self._remoteFilter(kw, render);
                }else {
                    self._syncFilter(kw, render);
                }
            });
        },
        _fetch: function(param, callback) {
            var self = this,
                lastModify = S.now();

            self._lastModify = lastModify;

            if(!param.url) {
                throw new Error("there is no data");
            }

            var ajaxParam = S.merge({
                    type: "GET",
                    dataType: "json",
                    error: function() {
                        alert("请求数据发生错误，请稍后重试。");
                    }
                }, param),
                fnReceive = self.cfg.fnReceive,
                fnSuccess = param.success || fnNoop;

            ajaxParam.success = function(data) {
                // 过期数据丢弃。
                if(lastModify < self._lastModify) {
                    return;
                }

                var returnValue = fnReceive(data);

                if(!returnValue) return;

                fnSuccess(returnValue);

                if(returnValue.result) {
                    callback && callback(returnValue.list);
                }else {
                    alert(returnValue.msg);
                }
            }

            IO(ajaxParam);
        },

        _runWithMatch: function(map, value, data) {
            data || (data = {});

            if(value == data.value) {
                S.each(map.match, function(fn) {
                    fn && fn({data: data});
                });
            }else {
                S.each(map.mismatch, function(fn){
                    fn && fn({data: data});
                });
            }
        },
        _autoMatchByText: function(text) {
            var datalist = this._data,
                data = datalist.getDataByText(text);
            return data;
        },
        _fillText: function(data) {
            var elText = this.elText;
            var elPlaceholder = this.elPlaceholder;
            if(this.cfg.mulSelect){
                data && this._addChosen(data);
                elText.value = EMPTY;
            }else{
                elText.value = data ? data.text : EMPTY;
            }
        },
        _addChosen: function(data){
            var elText = this.elText;
            var TEMPLATES = '<div class="search-choice">'+
                                '<span>{text}</span>'+
                                '<a class="search-choice-close" data-id="{__id}"></a>'+
                            '</div>';
            var html = S.substitute(TEMPLATES, data);
            cOption = D.create(html);
            D.insertBefore(cOption,elText);
            this._bindDelChosen(cOption);
            //适配input宽度，占位
            this._autoMatchInputWidth();
        },
        _bindDelChosen: function(cOption){
            var self = this;
            var aClose = D.get("a",cOption);
            E.on(aClose,"click",function(ev){
                ev.preventDefault();
                D.remove(cOption);
                var id = D.attr(this,"data-id");
                self._data.delData(id);
                self._autoMatchInputWidth();
                self.fire('change', {data: undefined, value:self.getValue()});
            });
        },
        _autoMatchInputWidth: function(){
            var elText = this.elText,
                allOpt = D.siblings(elText),
                maxW = D.width(D.parent(elText)),
                curW = 0;
            if(allOpt.length){
                for (var i = 0; i < allOpt.length; i++) {
                    var wid = D.outerWidth(allOpt[i])+parseInt(D.css(allOpt[i],"marginLeft"))+parseInt(D.css(allOpt[i],"marginRight"));
                    curW+=wid;
                    if(curW > maxW){
                        curW = wid;
                    }
                };
                D.css(elText,"width",(maxW-curW-3<50?"100%":maxW-curW-3));
                D.removeAttr(elText,"placeholder");
                !supportPlaceholder && D.hide(elPlaceholder);
            }else{
                D.css(elText,"width","100%");
                D.attr(elText,"placeholder",this.cfg.placeholder);
                !supportPlaceholder && D.show(elPlaceholder);
            }
        },
        _remoteFilter: function(kw, callback) {
            var self = this,
                cfg = self.cfg;

            var param = cfg.remote || {};

            param.data = S.merge(param.data, {
                text: kw
            });

            var ajaxParam = param;

            self._fetch(ajaxParam, function(data) {
                var dt = self._dataFactory(data);
                self._data.setDataSource(kw, dt);
                callback && callback(dt);
            });
        },
        _syncFilter: function(kw, callback) {
            var self = this,
                datalist = self._data,
                result = [];

            // 筛选出符合的元素
            S.each(datalist.getDataSource(), function(it) {
                if(it.text.indexOf(kw) !== -1) {
                    result.push(it);
                }
            });

            // 异步回调处理。
            callback && callback(result);
        },
        _stopHideTimer: function() {
            var timer = this._timer;
            // 确定取消计时器的运行
            if(timer.hide) {
                timer.hide.cancel();
                timer.hide = null;
            }
        },
        _latencyHide: function() {
            var self = this,
                timer = self._timer;
            self._stopHideTimer();

            timer.hide  = S.later(function() {
                self.hide();
            }, self.cfg.hideDelay);
        },
        getValue: function(){
            var selected = this.getSelectedData();
            if(this.cfg.mulSelect){
                var arrValue = [];
                if(selected && selected.length){
                    for (var i = 0; i < selected.length; i++) {
                        arrValue.push(selected[i].value);
                    }
                }
                return arrValue.join(",");
            }else{
                return selected?selected.value:"";
            }
        }
    });

    module.exports = DropList;
});
/*
 ToDo
 - selection range
 - different view
 - option disable status
 - optgroup support
*/



