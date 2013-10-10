/**
 * 默认，单页scroll式的数据。
 * 初次异步获取数据，或直接使用数据源或每次都异步获取数据。
 */

KISSY.add(function(S) {
    var UNIQUEKEY = "_id",
        QUEUEINDEX = '_index',

        def = {
            dataSource: null
        };

    function DataList() {
        this._init.apply(this, arguments);
    }

    S.augment(DataList, S.EventTarget, {
        _init: function(cfg) {

            cfg = this.cfg = S.merge(def, cfg);

            this._initSelected = cfg.selected;
        },
        dataFactory: function(list) {
            this._dataFactory(list);
        },
        getDataByValue: function(value) {
            if(!this._list) {
                return;
            }

            var result;
            S.each(this._list, function(it) {
                if(it.value === value) {
                    result = it;
                    return false;
                }
            });
            return result;
        },
        filter: function(data, callback) {
            var self = this,
                result = [];

            // 筛选出符合的元素
            S.each(self._list, function(it) {
                var yep = false;
                S.each(data, function(val, key) {
                    if(it[key].indexOf(val) !== -1) {
                        yep = true;
                        return false;
                    }
                });

                if(yep) {
                    result.push(it);
                }
            });

            // 异步回调处理。
            callback && callback(result);
        },
        select: function(id) {
            var data;
            if(id != undefined) {
                data = this._dataMap[id];
            }

            var prevData = this.selected;
            // 同一个选项，就不需要再次处理了。
            if(prevData == data ||
                prevData && data && data.value === prevData.value) {
                return;
            }

            this.selected = data;
            this.fire('selected', {data: data});
        },
        getSelectedData: function() {
            return this.selected || this._initSelected;
        },
        // 根据新数据，重新构造数据。
        _dataFactory: function(list) {
            var self = this,
                prevSelected = self.getSelectedData(),
                result = [],
                map = this._dataMap = {};

            self.selected = undefined;

            S.each(list, function(it, idx) {
                var _id = S.guid();
                if(it[UNIQUEKEY] === undefined) {
                    it[UNIQUEKEY] = _id;
                }

                it[QUEUEINDEX] = idx;
                map[_id] = it;
                result.push(it);

                // 匹配新数据中的选择项
                // 模拟原生select，只以value值为准即可。
                if(prevSelected && it.value == prevSelected.value) {
                    self.select(_id);
                }
            });

            delete self._initSelected;

            this._list = result;
        }
    });

    return DataList;
});