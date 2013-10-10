/**
 * 单页 scroll式的浮层。没有分页，没有分组。
 */

KISSY.add(function(S, Overlay, Template, Lap) {
    var D = S.DOM, E = S.Event;

    var EMPTY = "",
        TEMPLATES = {
            selectedCls: "selected",
            focusCls: "focus",
            itemCls: "drop-menuitem",
            prefixId: "dropmenu-item",
            menuItem: '<li class="drop-menuitem" id="dropmenu-item{{_id}}" data-id="{{_id}}">{{text}}</li>'
        };

    function View() {
        this.init.apply(this, arguments);
    }

    S.augment(View, S.EventTarget, {
        init: function(datalist) {
            var self = this,
                layer = new Overlay({
                    prefixCls: "dropmenu-"
                });

            self.layer = layer;
            self.elList = D.create('<ul></ul>')
            self.datalist = datalist;

            layer.on('afterRenderUI', function() {
                self._UIRender();
            });
        },
        /**
         * @public 渲染指定的数据
         * TODO 完善+限定高度的渲染。
         * @param list
         * @return boolean 若返回值为false，则列表元素隐藏。其他情况下显示
         */
        render: function(list) {
            if(!list || list.length == 0) {
                return false;
            }

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

            return true;
        },
        _itemRender: function(data) {
            if(!data) return null;
            var html = Template(TEMPLATES.menuItem).render(data),
                el = D.create(html),
                selected = this.datalist.selected;

            if(selected && selected.value === data.value) {
                this._selectElement(el);
            }

            return el;
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
            self.fire('UIRender');
        },
        _bindList: function() {
            var self = this,
                elList = self.elList;

            E.on(elList, 'click', function(ev) {
                var target = ev.target;
                if(!D.hasClass(target, TEMPLATES.itemCls)) {
                    target = D.parent(target, TEMPLATES.itemCls);
                }

                if(!target) return;

                var _id = D.attr(target, 'data-id');
                self.fire('itemClick', {id: _id})
            });
        },
        /**
         * @public 根据clientId 选择指定的元素。若不存在，则取消选择
         * @param id
         */
        select: function(id) {
            var elItem = D.get('#' + TEMPLATES.prefixId+id, this.elList);

            this._selectElement(elItem);
        },
        _selectElement: function(elItem) {
            D.removeClass(this.selectedItem, TEMPLATES.selectedCls);
            D.addClass(elItem, TEMPLATES.selectedCls);
            this.selectedItem = elItem;
        },
        /**
         * @public 根据clientId 聚焦指定的元素。若不存在，则取消聚焦
         * @param id
         */
        focus: function(id) {
            var elItem = D.get('#' + TEMPLATES.prefixId+id, this.elList);

            D.removeClass(this.focusItem, TEMPLATES.focusCls);
            D.addClass(elItem, TEMPLATES.focusCls);
            this.focusItem = elItem;
        },
        /**
         * @public 显示和隐藏
         * @param isVisible
         */
        visible: function(isVisible) {
            if(isVisible) {
                this.layer.show();
            }else {
                this.layer.hide();
            }
        },
        /**
         * @public 浮层的定位。按照overlay的align定义。
         * @param align
         */
        align: function(align) {
            this.layer.set('align', align);
        },
        /**
         * TODO 指定项显示在当前可视视图内
         */
        scrollIntoView: function() {

        }
    });

    return View;
}, {
    requires: ['overlay', 'template', './lap']
});