// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Various actions on modules and sections in the editing mode - hiding, duplicating, deleting, etc.
 *
 * @module     core_course/actions
 * @package    core
 * @copyright  2016 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @since      3.3
 */
define(['jquery', 'core/ajax', 'core/templates', 'core/notification',
    'core/str', 'core/url', 'core/yui', 'core/fragment', 'core/modal_factory'],
    function($, ajax, templates, notification, str, url, Y, Fragment, ModalFactory) {
        var CSS = {
            EDITINPROGRESS: 'editinprogress',
            SECTIONDRAGGABLE: 'sectiondraggable',
            EDITINGMOVE: 'editing_move'
        };
        var SELECTOR = {
            ACTIVITYLI: 'li.activity',
            ACTIONAREA: '.actions',
            ACTIVITYACTION: 'a.cm-edit-action',
            MENU: '.moodle-actionmenu[data-enhance=moodle-core-actionmenu]',
            TOGGLE: '.toggle-display,.dropdown-toggle',
            SECTIONLI: 'li.section',
            SECTIONACTIONMENU: '.section_action_menu',
            MODALCONTAINER: 'div.modal',
            MODAL: 'div.modal-content',
            FORM: '#mform1',
            SUBMITBUTTON: '#id_submitbutton',
            SUBMITBUTTON2: '#id_submitbutton2',
            CANCELBUTTON: '#id_cancel',
            CANCELBUTTON2: 'div.modal-header button[data-action=hide]',
            URL_JUMP: '#chooserform input[type=hidden][name=jump]',
            BUTTON_ADD: '#chooserform input[type=submit][name=submitbutton]',
            SECTION_UL: 'ul.section',
        };

        Y.use('moodle-course-coursebase', function() {
            var courseformatselector = M.course.format.get_section_selector();
            if (courseformatselector) {
                SELECTOR.SECTIONLI = courseformatselector;
            }
        });

        /**
         * Wrapper for Y.Moodle.core_course.util.cm.getId
         *
         * @param {JQuery} element
         * @returns {Integer}
         */
        var getModuleId = function(element) {
            var id;
            Y.use('moodle-course-util', function(Y) {
                id = Y.Moodle.core_course.util.cm.getId(Y.Node(element.get(0)));
            });
            return id;
        };

        /**
         * Wrapper for Y.Moodle.core_course.util.cm.getName
         *
         * @param {JQuery} element
         * @returns {String}
         */
        var getModuleName = function(element) {
            var name;
            Y.use('moodle-course-util', function(Y) {
                name = Y.Moodle.core_course.util.cm.getName(Y.Node(element.get(0)));
            });
            return name;
        };

        /**
         * Wrapper for M.util.add_spinner for an activity
         *
         * @param {JQuery} activity
         * @returns {Node}
         */
        var addActivitySpinner = function(activity) {
            activity.addClass(CSS.EDITINPROGRESS);
            var actionarea = activity.find(SELECTOR.ACTIONAREA).get(0);
            if (actionarea) {
                var spinner = M.util.add_spinner(Y, Y.Node(actionarea));
                spinner.show();
                return spinner;
            }
            return null;
        };

        /**
         * Wrapper for M.util.add_spinner for a section
         *
         * @param {JQuery} sectionelement
         * @returns {Node}
         */
        var addSectionSpinner = function(sectionelement) {
            sectionelement.addClass(CSS.EDITINPROGRESS);
            var actionarea = sectionelement.find(SELECTOR.SECTIONACTIONMENU).get(0);
            if (actionarea) {
                var spinner = M.util.add_spinner(Y, Y.Node(actionarea));
                spinner.show();
                return spinner;
            }
            return null;
        };

        /**
         * Wrapper for M.util.add_lightbox
         *
         * @param {JQuery} sectionelement
         * @returns {Node}
         */
        var addSectionLightbox = function(sectionelement) {
            var lightbox = M.util.add_lightbox(Y, Y.Node(sectionelement.get(0)));
            lightbox.show();
            return lightbox;
        };

        /**
         * Removes the spinner element
         *
         * @param {JQuery} element
         * @param {Node} spinner
         * @param {Number} delay
         */
        var removeSpinner = function(element, spinner, delay) {
            window.setTimeout(function() {
                element.removeClass(CSS.EDITINPROGRESS);
                if (spinner) {
                    spinner.hide();
                }
            }, delay);
        };

        /**
         * Removes the lightbox element
         *
         * @param {Node} lightbox lighbox YUI element returned by addSectionLightbox
         * @param {Number} delay
         */
        var removeLightbox = function(lightbox, delay) {
            if (lightbox) {
                window.setTimeout(function() {
                    lightbox.hide();
                }, delay);
            }
        };

        /**
         * Initialise action menu for the element (section or module)
         *
         * @param {String} elementid CSS id attribute of the element
         * @param {Boolean} openmenu whether to open menu - this can be used when re-initiating menu after indent action was pressed
         */
        var initActionMenu = function(elementid, openmenu) {
            // Initialise action menu in the new activity.
            Y.use('moodle-course-coursebase', function() {
                M.course.coursebase.invoke_function('setup_for_resource', '#' + elementid);
            });
            if (M.core.actionmenu && M.core.actionmenu.newDOMNode) {
                M.core.actionmenu.newDOMNode(Y.one('#' + elementid));
            }
            // Open action menu if the original element had data-keepopen.
            if (openmenu) {
                // We must use YUI click simulate here so the toggle works in Clean theme. This toggle is not
                // needed in Boost because we use standard bootstrapbase action menu.
                var toggle = Y.one('#' + elementid + ' ' + SELECTOR.MENU).one(SELECTOR.TOGGLE);
                if (toggle && toggle.simulate) {
                    toggle.simulate('click');
                }
            }
        };

        /**
         * Returns focus to the element that was clicked or "Edit" link if element is no longer visible.
         *
         * @param {String} elementId CSS id attribute of the element
         * @param {String} action data-action property of the element that was clicked
         */
        var focusActionItem = function(elementId, action) {
            var mainelement = $('#' + elementId);
            var selector = '[data-action=' + action + ']';
            if (action === 'groupsseparate' || action === 'groupsvisible' || action === 'groupsnone') {
                // New element will have different data-action.
                selector = '[data-action=groupsseparate],[data-action=groupsvisible],[data-action=groupsnone]';
            }
            if (mainelement.find(selector).is(':visible')) {
                mainelement.find(selector).focus();
            } else {
                // Element not visible, focus the "Edit" link.
                mainelement.find(SELECTOR.MENU).find(SELECTOR.TOGGLE).focus();
            }
        };

        /**
         * Find next <a> after the element
         *
         * @param {JQuery} mainElement element that is about to be deleted
         * @returns {JQuery}
         */
        var findNextFocusable = function(mainElement) {
            var tabables = $("a:visible");
            var isInside = false, foundElement = null;
            tabables.each(function() {
                if ($.contains(mainElement[0], this)) {
                    isInside = true;
                } else if (isInside) {
                    foundElement = this;
                    return false; // Returning false in .each() is equivalent to "break;" inside the loop in php.
                }
            });
            return foundElement;
        };

        /**
         * Gets request params from url
         *
         * @param {String} url Url to get params
         * @returns {Object}
         */
        var getRequestParams = function(url) {
            var params = {};
            var tokens = url.substr(url.indexOf('?') + 1).split('&');
            for (var i in tokens) {
                var token = tokens[i].split('=');
                params[decodeURIComponent(token[0])] = decodeURIComponent(token[1]);
            }
            return params;
        };

        /**
         * Loads editting form of resource/activity
         *
         * @param {JQuery} moduleElement activity element we need to load editing form
         * @param {Number} cmid
         * @param {JQuery} target the element (menu item) that was clicked
         */
        var loadModuleEditingForm = function(moduleElement, cmid, target) {
            var url = target.attr('href');
            var params = getRequestParams(url);
            var promises = ajax.call([{
                methodname: 'core_course_get_course_module_editing_dialog',
                args: {update: cmid, sectionreturn: params.sr}
            }], true);
            var lightbox = addPageLightbox();
            $.when.apply($, promises)
                .done(function(data) {
                    removePageLightbox(lightbox);
                    showModuleEditingForm(moduleElement, data.html, data.javascript, cmid, params.module_type, params.sr);
                });
        };

        /**
         * Show resource/activity editting form
         *
         * @param {JQuery} moduleElement activity element we need to load editing form
         * @param {String} html
         * @param {String} javascript
         * @param {Number} cmid
         * @param {String} moduleType
         * @param {Number} sectionreturn
         * @param {JQuery} target the element (menu item) that was clicked
         */
        var showModuleEditingForm = function(moduleElement, html, javascript, cmid, moduleType, sectionreturn) {
            var jsNodes = $(javascript);
            // The first node always contains redefinition of require.
            // It should be removed, otherwise, function require will be overwritten by variable require.
            jsNodes.splice(0, 1);
            var js = collectScriptFromScriptNodes(jsNodes);
            removePreviousModalAndScript();
            ModalFactory.create({
                title: "Update " + moduleType,
                body: html,
            })
            .done(function(modal) {
                modal.show();
                // Set style for modal
                $(SELECTOR.MODAL).css({
                    width: "800px",
                    height: "500px",
                    left: "50%",
                    "margin-left":  "-400px",
                    overflow: "auto",
                    border: "1px solid black"
                });

                // Handle form submission
                $(SELECTOR.SUBMITBUTTON2).click(function(e) {
                    e.preventDefault();
                    onSubmitModuleEditingForm(moduleElement, cmid, moduleType, sectionreturn, modal);
                });
                // Handle cancel submission
                $(SELECTOR.CANCELBUTTON + ',' + SELECTOR.CANCELBUTTON2).on('click', function(e) {
                    e.preventDefault();
                    hideModal(modal);
                });
                // Handle esc
                $('body').on('keydown', function(e) {
                    if (e.keyCode === 27) {
                        hideModal(modal);
                    }
                });

                // Append response script to document
                var validatorName = "validate_mod_" + moduleType + "_mod_form";
                var formListenerDecl = "document.getElementById('mform1').addEventListener";
                js = js.replace(formListenerDecl, 'window.clientSideValidator=' + validatorName + ';\n' + formListenerDecl);
                var scriptElement = document.createElement('script');
                scriptElement.textContent = js;
                document.head.appendChild(scriptElement);
            });
        };

        /**
         * Submits form via ajax call
         *
         * @param {JQuery} moduleElement activity element we need to edit
         * @param {Number} cmid
         * @param {Object} moduleType
         * @param {Number} sectionreturn
         * @param {Object} modal
         */
        var onSubmitModuleEditingForm = function(moduleElement, cmid, moduleType, sectionreturn, modal) {
            var isValidated = false;
            try {
                var myValidator = window.clientSideValidator;
                if (typeof window.tinyMCE !== 'undefined') {
                    window.tinyMCE.triggerSave();
                }
                isValidated = myValidator();
            } catch(e) {
                isValidated = true;
            }
            if (isValidated) {
                // Disable other submit buttons
                $(SELECTOR.CANCELBUTTON)
                    .prop('disabled', 'disabled');
                var submitButton = $(SELECTOR.SUBMITBUTTON);
                if (submitButton !== null) {
                    submitButton.prop('disabled', 'disabled');
                }

                var promises = ajax.call([{
                    methodname: 'core_course_submit_module_editing_form',
                    args: {
                        moduleid: cmid,
                        sectionreturn: 0,
                        jsonformdata: JSON.stringify($(SELECTOR.FORM).serialize())
                    }
                 }], true);

                $.when.apply($, promises).done(function(data) {
                    if (data.error) {
                        showModuleEditingForm(moduleElement, data.html, data.javascript, cmid, moduleType, sectionreturn);
                    } else {
                        moduleElement.replaceWith(data.html);
                        $('<div>' + data.html + '</div>').find(SELECTOR.ACTIVITYLI).each(function() {
                            initActionMenu($(this).attr('id'), false);
                        });
                        hideModal(modal);
                    }
                });
            }
        };

        /**
         * Collect contents of script nodes (for creating single node and append to page)
         *
         * @param {JQuery} jsNodes
         * @return {string}
         */
        var collectScriptFromScriptNodes = function(jsNodes) {
            var allScript = '';
            jsNodes.each(function(index, scriptNode) {
                scriptNode = $(scriptNode);
                var tagName = scriptNode.prop('tagName');
                if (tagName && (tagName.toLowerCase() == 'script')) {
                    if (scriptNode.attr('src')) {
                        // We only reload the script if it was not loaded already.
                        var exists = false;
                        $('script').each(function(index, s) {
                            if ($(s).attr('src') == scriptNode.attr('src')) {
                                exists = true;
                            }
                            return !exists;
                        });
                        if (!exists) {
                            allScript += ' { ';
                            allScript += ' node = document.createElement("script"); ';
                            allScript += ' node.type = "text/javascript"; ';
                            allScript += ' node.src = decodeURI("' + encodeURI(scriptNode.attr('src')) + '"); ';
                            allScript += ' document.getElementsByTagName("head")[0].appendChild(node); ';
                            allScript += ' } ';
                        }
                    } else {
                        allScript += ' ' + scriptNode.text();
                    }
                }
            });
            return allScript;
        };

        /**
         * Load form to create new resource/activity
         */
        var loadModuleAddingForm = function() {
            var jumpUrl = $(SELECTOR.URL_JUMP).val();
            var params = getRequestParams(jumpUrl);

            var sectionElement = $('#section-' + params.section + ' ' + SELECTOR.SECTION_UL);

            var promises = ajax.call([{
                methodname: 'core_course_get_course_module_adding_dialog',
                args: {courseid: params.id, section: params.section, add: params.add, sectionreturn: params.sr}
            }], true);

            $('.addcancel').trigger('click');
            var lightbox = addPageLightbox();
            $.when.apply($, promises)
                .done(function(data) {
                    removePageLightbox(lightbox);
                    showModuleAddingForm(sectionElement, params.section, data.html, data.javascript, params.add, params.sr);
                });
        };

        /**
         * Show resource/activity adding form
         *
         * @param {JQuery} sectionElement section, in which we need to create new resource/activity
         * @param {Number} sectionid
         * @param {String} html
         * @param {String} javascript
         * @param {String} moduleType
         * @param {Number} sectionreturn
         */
        var showModuleAddingForm = function(sectionElement, sectionid, html, javascript, moduleType, sectionreturn) {
            var jsNodes = $(javascript);
            // The first node always contains redefinition of require.
            // It should be removed, otherwise, function require will be overwritten by variable require.
            jsNodes.splice(0, 1);
            var js = collectScriptFromScriptNodes(jsNodes);
            removePreviousModalAndScript();
            ModalFactory.create({
                    title: "Add " + moduleType,
                    body: html,
                })
                .done(function(modal) {
                    modal.show();
                    // Set style for modal
                    $(SELECTOR.MODAL).css({
                        width: "800px",
                        height: "500px",
                        left: "50%",
                        "margin-left":  "-400px",
                        overflow: "auto",
                        border: "1px solid black"
                    });
                    // Append response script to document
                    var validatorName = "validate_mod_" + moduleType + "_mod_form";
                    var formListenerDecl = "document.getElementById('mform1').addEventListener";
                    js = js.replace(formListenerDecl, 'window.clientSideValidator=' + validatorName + ';\n' + formListenerDecl);
                    var scriptElement = document.createElement('script');
                    scriptElement.textContent = js;
                    document.head.appendChild(scriptElement);
                    // Handle form submission
                    $(SELECTOR.SUBMITBUTTON2).click(function(e) {
                        e.preventDefault();
                        onSubmitModuleAddingForm(sectionElement, sectionid, moduleType, modal, sectionreturn);
                    });
                    // Handle cancel submission
                    $(SELECTOR.CANCELBUTTON + ',' + SELECTOR.CANCELBUTTON2).on('click', function(e) {
                        e.preventDefault();
                        hideModal(modal);
                    });
                    // Handle esc
                    $('body').on('keydown', function(e) {
                        if (e.keyCode === 27) {
                            hideModal(modal);
                    }
                });
            });
        };

        /**
         * Submit form adding resource via ajax call
         *
         * @param {JQuery} sectionElement section, in which we need to create new resource/activity
         * @param {Number} sectionid
         * @param {String} moduleType
         * @param {Jquery} modal
         * @param {Number} sectionreturn
         */
        var onSubmitModuleAddingForm = function(sectionElement, sectionid, moduleType, modal, sectionreturn) {
            var isValidated = false;
            if (window.clientSideValidator) {
                try {
                    var myValidator = window.clientSideValidator;
                    if (typeof window.tinyMCE !== 'undefined') {
                        window.tinyMCE.triggerSave();
                    }
                    isValidated = myValidator();
                } catch (e) {
                    isValidated = false;
                }
            } else {
                isValidated = true;
            }

            if (isValidated) {
                // Disable other submit buttons
                $(SELECTOR.CANCELBUTTON)
                    .prop('disabled', true);
                $(SELECTOR.SUBMITBUTTON)
                    .prop('disabled', true);
                var requestParams = getRequestParams(document.URL.split('#')[0]);
                var promises = ajax.call([{
                    methodname: 'core_course_submit_module_adding_form',
                    args: {
                        section: sectionid,
                        course: requestParams.id,
                        add: moduleType,
                        sectionreturn: sectionreturn,
                        jsonformdata: JSON.stringify($(SELECTOR.FORM).serialize())
                    }
                 }], true);
                $.when.apply($, promises).done(function(data) {
                    if (data.error) {
                        showModuleAddingForm(sectionElement, sectionid, data.html, data.javascript, moduleType, sectionreturn);
                    } else {
                        sectionElement.append(data.html);
                        $('<div>' + data.html + '</div>').find(SELECTOR.ACTIVITYLI).each(function() {
                            initActionMenu($(this).attr('id'), false);
                        });
                        // Hide modal
                        hideModal(modal);
                    }
                });
            }
        };

        /**
         * Remove modal
         *
         * @param {Modal} modal
         */
        var hideModal = function(modal) {
            modal.hide();
            window.onbeforeunload = null;
        };

        /**
         * Add lightbox to page
         *
         */
        var addPageLightbox = function() {
            var lightbox = M.util.add_lightbox(Y, Y.Node($('body')[0]));
            lightbox.setStyle('position', 'fixed');
            lightbox.setStyle('z-index', '1055');
            lightbox.show();
            return lightbox;
        };

        /**
        * Remove page lightbox
        *
        * @param {Node} lightbox lighbox YUI element returned by addPageLightbox
        */
        var removePageLightbox = function(lightbox) {
            // Recover property position of body, which was changed when adding lightbox
            $('body').css('position', 'static');
            lightbox.remove();
        };

        /**
         * Removes editting form and appended script of editting form
         *
         * @param {Object} modal activity element we need to load editing form
         */
        var removePreviousModalAndScript = function() {
            $(SELECTOR.MODALCONTAINER).each(function() {
                this.remove();
            });
            $('footer').siblings('script').each(function() {
                this.remove();
            });
            // Prevent browser from warning about form dirty state.
            window.onbeforeunload = null;
        };

        /**
         * Performs an action on a module (moving, deleting, duplicating, hiding, etc.)
         *
         * @param {JQuery} moduleElement activity element we perform action on
         * @param {Number} cmid
         * @param {JQuery} target the element (menu item) that was clicked
         */
        var editModule = function(moduleElement, cmid, target) {
            var keepopen = target.attr('data-keepopen'),
                    action = target.attr('data-action');
            var spinner = addActivitySpinner(moduleElement);
            var promises = ajax.call([{
                methodname: 'core_course_edit_module',
                args: {id: cmid,
                    action: action,
                    sectionreturn: target.attr('data-sectionreturn') ? target.attr('data-sectionreturn') : 0
                }
            }], true);

            var lightbox;
            if (action === 'duplicate') {
                lightbox = addSectionLightbox(target.closest(SELECTOR.SECTIONLI));
            }
            $.when.apply($, promises)
                .done(function(data) {
                    var elementToFocus = findNextFocusable(moduleElement);
                    moduleElement.replaceWith(data);
                    // Initialise action menu for activity(ies) added as a result of this.
                    $('<div>' + data + '</div>').find(SELECTOR.ACTIVITYLI).each(function(index) {
                        initActionMenu($(this).attr('id'), keepopen);
                        if (index === 0) {
                            focusActionItem($(this).attr('id'), action);
                            elementToFocus = null;
                        }
                    });
                    // In case of activity deletion focus the next focusable element.
                    if (elementToFocus) {
                        elementToFocus.focus();
                    }
                    // Remove spinner and lightbox with a delay.
                    removeSpinner(moduleElement, spinner, 400);
                    removeLightbox(lightbox, 400);
                    // Trigger event that can be observed by course formats.
                    moduleElement.trigger($.Event('coursemoduleedited', {ajaxreturn: data, action: action}));
                }).fail(function(ex) {
                    // Remove spinner and lightbox.
                    removeSpinner(moduleElement, spinner);
                    removeLightbox(lightbox);
                    // Trigger event that can be observed by course formats.
                    var e = $.Event('coursemoduleeditfailed', {exception: ex, action: action});
                    moduleElement.trigger(e);
                    if (!e.isDefaultPrevented()) {
                        notification.exception(ex);
                    }
                });
        };

        /**
         * Requests html for the module via WS core_course_get_module and updates the module on the course page
         *
         * Used after d&d of the module to another section
         *
         * @param {JQuery} activityElement
         * @param {Number} cmid
         * @param {Number} sectionreturn
         */
        var refreshModule = function(activityElement, cmid, sectionreturn) {
            var spinner = addActivitySpinner(activityElement);
            var promises = ajax.call([{
                methodname: 'core_course_get_module',
                args: {id: cmid, sectionreturn: sectionreturn}
            }], true);

            $.when.apply($, promises)
                .done(function(data) {
                    removeSpinner(activityElement, spinner, 400);
                    replaceActivityHtmlWith(data);
                }).fail(function() {
                    removeSpinner(activityElement, spinner);
                });
        };

        /**
         * Displays the delete confirmation to delete a module
         *
         * @param {JQuery} mainelement activity element we perform action on
         * @param {function} onconfirm function to execute on confirm
         */
        var confirmDeleteModule = function(mainelement, onconfirm) {
            var modtypename = mainelement.attr('class').match(/modtype_([^\s]*)/)[1];
            var modulename = getModuleName(mainelement);

            str.get_string('pluginname', modtypename).done(function(pluginname) {
                var plugindata = {
                    type: pluginname,
                    name: modulename
                };
                str.get_strings([
                    {key: 'confirm'},
                    {key: modulename === null ? 'deletechecktype' : 'deletechecktypename', param: plugindata},
                    {key: 'yes'},
                    {key: 'no'}
                ]).done(function(s) {
                        notification.confirm(s[0], s[1], s[2], s[3], onconfirm);
                    }
                );
            });
        };

        /**
         * Displays the delete confirmation to delete a section
         *
         * @param {String} message confirmation message
         * @param {function} onconfirm function to execute on confirm
         */
        var confirmEditSection = function(message, onconfirm) {
            str.get_strings([
                {key: 'confirm'}, // TODO link text
                {key: 'yes'},
                {key: 'no'}
            ]).done(function(s) {
                    notification.confirm(s[0], message, s[1], s[2], onconfirm);
                }
            );
        };

        /**
         * Replaces an action menu item with another one (for example Show->Hide, Set marker->Remove marker)
         *
         * @param {JQuery} actionitem
         * @param {String} image new image name ("i/show", "i/hide", etc.)
         * @param {String} stringname new string for the action menu item
         * @param {String} stringcomponent
         * @param {String} titlestr string for "title" attribute (if different from stringname)
         * @param {String} titlecomponent
         * @param {String} newaction new value for data-action attribute of the link
         */
        var replaceActionItem = function(actionitem, image, stringname,
                                           stringcomponent, titlestr, titlecomponent, newaction) {
            actionitem.find('img').attr('src', url.imageUrl(image, 'core'));
            str.get_string(stringname, stringcomponent).done(function(newstring) {
                actionitem.find('span.menu-action-text').html(newstring);
                actionitem.attr('title', newstring);
            });
            if (titlestr) {
                str.get_string(titlestr, titlecomponent).done(function(newtitle) {
                    actionitem.attr('title', newtitle);
                });
            }
            actionitem.attr('data-action', newaction);
        };

        /**
         * Default post-processing for section AJAX edit actions.
         *
         * This can be overridden in course formats by listening to event coursesectionedited:
         *
         * $('body').on('coursesectionedited', 'li.section', function(e) {
         *     var action = e.action,
         *         sectionElement = $(e.target),
         *         data = e.ajaxreturn;
         *     // ... Do some processing here.
         *     e.preventDefault(); // Prevent default handler.
         * });
         *
         * @param {JQuery} sectionElement
         * @param {JQuery} actionItem
         * @param {Object} data
         * @param {String} courseformat
         */
        var defaultEditSectionHandler = function(sectionElement, actionItem, data, courseformat) {
            var action = actionItem.attr('data-action');
            if (action === 'hide' || action === 'show') {
                if (action === 'hide') {
                    sectionElement.addClass('hidden');
                    replaceActionItem(actionItem, 'i/show',
                        'showfromothers', 'format_' + courseformat, null, null, 'show');
                } else {
                    sectionElement.removeClass('hidden');
                    replaceActionItem(actionItem, 'i/hide',
                        'hidefromothers', 'format_' + courseformat, null, null, 'hide');
                }
                // Replace the modules with new html (that indicates that they are now hidden or not hidden).
                if (data.modules !== undefined) {
                    for (var i in data.modules) {
                        replaceActivityHtmlWith(data.modules[i]);
                    }
                }
                // Replace the section availability information.
                if (data.section_availability !== undefined) {
                    sectionElement.find('.section_availability').first().replaceWith(data.section_availability);
                }
            } else if (action === 'setmarker') {
                var oldmarker = $(SELECTOR.SECTIONLI + '.current'),
                    oldActionItem = oldmarker.find(SELECTOR.SECTIONACTIONMENU + ' ' + 'a[data-action=removemarker]');
                oldmarker.removeClass('current');
                replaceActionItem(oldActionItem, 'i/marker',
                    'highlight', 'core', 'markthistopic', 'core', 'setmarker');
                sectionElement.addClass('current');
                replaceActionItem(actionItem, 'i/marked',
                    'highlightoff', 'core', 'markedthistopic', 'core', 'removemarker');
            } else if (action === 'removemarker') {
                sectionElement.removeClass('current');
                replaceActionItem(actionItem, 'i/marker',
                    'highlight', 'core', 'markthistopic', 'core', 'setmarker');
            }
        };

        /**
         * Replaces the course module with the new html (used to update module after it was edited or its visibility was changed).
         *
         * @param {String} activityHTML
         */
        var replaceActivityHtmlWith = function(activityHTML) {
            $('<div>' + activityHTML + '</div>').find(SELECTOR.ACTIVITYLI).each(function() {
                // Extract id from the new activity html.
                var id = $(this).attr('id');
                // Find the existing element with the same id and replace its contents with new html.
                $(SELECTOR.ACTIVITYLI + '#' + id).replaceWith(activityHTML);
                // Initialise action menu.
                initActionMenu(id, false);
            });
        };

        /**
         * Performs an action on a module (moving, deleting, duplicating, hiding, etc.)
         *
         * @param {JQuery} sectionElement section element we perform action on
         * @param {Nunmber} sectionid
         * @param {JQuery} target the element (menu item) that was clicked
         * @param {String} courseformat
         */
        var editSection = function(sectionElement, sectionid, target, courseformat) {
            var action = target.attr('data-action'),
                sectionreturn = target.attr('data-sectionreturn') ? target.attr('data-sectionreturn') : 0;
            var spinner = addSectionSpinner(sectionElement);
            var promises = ajax.call([{
                methodname: 'core_course_edit_section',
                args: {id: sectionid, action: action, sectionreturn: sectionreturn}
            }], true);

            var lightbox = addSectionLightbox(sectionElement);
            $.when.apply($, promises)
                .done(function(dataencoded) {
                    var data = $.parseJSON(dataencoded);
                    removeSpinner(sectionElement, spinner);
                    removeLightbox(lightbox);
                    sectionElement.find(SELECTOR.SECTIONACTIONMENU).find(SELECTOR.TOGGLE).focus();
                    // Trigger event that can be observed by course formats.
                    var e = $.Event('coursesectionedited', {ajaxreturn: data, action: action});
                    sectionElement.trigger(e);
                    if (!e.isDefaultPrevented()) {
                        defaultEditSectionHandler(sectionElement, target, data, courseformat);
                    }
                }).fail(function(ex) {
                    // Remove spinner and lightbox.
                    removeSpinner(sectionElement, spinner);
                    removeLightbox(lightbox);
                    // Trigger event that can be observed by course formats.
                    var e = $.Event('coursesectioneditfailed', {exception: ex, action: action});
                    sectionElement.trigger(e);
                    if (!e.isDefaultPrevented()) {
                        notification.exception(ex);
                    }
                });
        };

        // Register a function to be executed after D&D of an activity.
        Y.use('moodle-course-coursebase', function() {
            M.course.coursebase.register_module({
                // Ignore camelcase eslint rule for the next line because it is an expected name of the callback.
                // eslint-disable-next-line camelcase
                set_visibility_resource_ui: function(args) {
                    var mainelement = $(args.element.getDOMNode());
                    var cmid = getModuleId(mainelement);
                    if (cmid) {
                        var sectionreturn = mainelement.find('.' + CSS.EDITINGMOVE).attr('data-sectionreturn');
                        refreshModule(mainelement, cmid, sectionreturn);
                    }
                }
            });
        });

        return /** @alias module:core_course/actions */ {

            /**
             * Initialises course page
             *
             * @method init
             * @param {String} courseformat name of the current course format (for fetching strings)
             */
            initCoursePage: function(courseformat) {

                // Add a handler for course module actions.
                $('body').on('click keypress', SELECTOR.ACTIVITYLI + ' ' +
                        SELECTOR.ACTIVITYACTION + '[data-action]', function(e) {
                    if (e.type === 'keypress' && e.keyCode !== 13) {
                        return;
                    }
                    var actionItem = $(this),
                        moduleElement = actionItem.closest(SELECTOR.ACTIVITYLI),
                        action = actionItem.attr('data-action'),
                        moduleId = getModuleId(moduleElement);
                    switch (action) {
                        case 'update':
                        case 'moveleft':
                        case 'moveright':
                        case 'delete':
                        case 'duplicate':
                        case 'hide':
                        case 'stealth':
                        case 'show':
                        case 'groupsseparate':
                        case 'groupsvisible':
                        case 'groupsnone':
                            break;
                        default:
                            // Nothing to do here!
                            return;
                    }
                    if (!moduleId) {
                        return;
                    }
                    e.preventDefault();
                    if (action === 'delete') {
                        // Deleting requires confirmation.
                        confirmDeleteModule(moduleElement, function() {
                            editModule(moduleElement, moduleId, actionItem);
                        });
                    } else if (action === 'update') {
                        loadModuleEditingForm(moduleElement, moduleId, actionItem);
                    } else {
                        editModule(moduleElement, moduleId, actionItem);
                    }
                });

                $('body').on('click keypress', SELECTOR.BUTTON_ADD, function(e) {
                    e.preventDefault();
                    loadModuleAddingForm();
                });

                // Add a handler for section show/hide actions.
                $('body').on('click keypress', SELECTOR.SECTIONLI + ' ' +
                            SELECTOR.SECTIONACTIONMENU + '[data-sectionid] ' +
                            'a[data-action]', function(e) {
                    if (e.type === 'keypress' && e.keyCode !== 13) {
                        return;
                    }
                    var actionItem = $(this),
                        sectionElement = actionItem.closest(SELECTOR.SECTIONLI),
                        sectionId = actionItem.closest(SELECTOR.SECTIONACTIONMENU).attr('data-sectionid');
                    e.preventDefault();
                    if (actionItem.attr('data-confirm')) {
                        // Action requires confirmation.
                        confirmEditSection(actionItem.attr('data-confirm'), function() {
                            editSection(sectionElement, sectionId, actionItem, courseformat);
                        });
                    } else {
                        editSection(sectionElement, sectionId, actionItem, courseformat);
                    }
                });
            },

            /**
             * Replaces a section action menu item with another one (for example Show->Hide, Set marker->Remove marker)
             *
             * This method can be used by course formats in their listener to the coursesectionedited event
             *
             * @param {JQuery} sectionelement
             * @param {String} selector CSS selector inside the section element, for example "a[data-action=show]"
             * @param {String} image new image name ("i/show", "i/hide", etc.)
             * @param {String} stringname new string for the action menu item
             * @param {String} stringcomponent
             * @param {String} titlestr string for "title" attribute (if different from stringname)
             * @param {String} titlecomponent
             * @param {String} newaction new value for data-action attribute of the link
             */
            replaceSectionActionItem: function(sectionelement, selector, image, stringname,
                                                    stringcomponent, titlestr, titlecomponent, newaction) {
                var actionitem = sectionelement.find(SELECTOR.SECTIONACTIONMENU + ' ' + selector);
                replaceActionItem(actionitem, image, stringname, stringcomponent, titlestr, titlecomponent, newaction);
            }
        };
    });