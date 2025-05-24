import * as vscode from 'vscode';

export interface CbsParameterInfo {
  label: string;
  documentation?: string | vscode.MarkdownString;
}

export interface CbsCommandInfo {
  name: string; // The primary command name (e.g., 'user', 'if', 'replace')
  aliases?: string[];
  description: string | vscode.MarkdownString;
  signatureLabel: string; // Full signature like 'replace::text::search::replace' or 'user'
  parameters?: CbsParameterInfo[];
  isBlock?: boolean; // True if it starts with #
  isPrefixCommand?: boolean; // True if it uses ':' separator like 'reverse:A'
  isInternal?: boolean; // For commands not typically for direct user use
}

export const cbsCommandsData: CbsCommandInfo[] = [
  // Data Syntaxes
  { name: 'user', description: "Replaced with the persona's name.", signatureLabel: 'user' },
  { name: 'char', aliases: ['bot'], description: "Replaced with the character's name.", signatureLabel: 'char' },
  { name: 'personality', aliases: ['char_persona', 'charpersona'], description: "Replaced with the character's personality.", signatureLabel: 'personality' },
  { name: 'description', aliases: ['char_desc', 'chardesc'], description: "Replaced with the character's description.", signatureLabel: 'description' },
  { name: 'example_dialogue', aliases: ['example_message', 'exampledialogue', 'examplemessage'], description: 'Replaced with an array of example dialogue.', signatureLabel: 'example_dialogue' },
  { name: 'persona', aliases: ['user_persona', 'userpersona'], description: "Replaced with the persona's description.", signatureLabel: 'persona' },
  { name: 'lorebook', aliases: ['world_info', 'worldinfo'], description: 'Replaced with array of lorebook entries.', signatureLabel: 'lorebook' },
  { name: 'history', aliases: ['messages'], description: 'Replaced with array of messages in current chat. Can optionally include role with history::role.', signatureLabel: 'history::[role]', parameters: [{ label: 'role', documentation: 'Optional. If present, includes the role (user/char) before each message.' }] },
  { name: 'chat_index', aliases: ['chatindex'], description: 'Replaced with the index of the message in the chat.', signatureLabel: 'chat_index' },
  { name: 'model', description: 'Replaced with the current model id.', signatureLabel: 'model' },
  { name: 'axmodel', description: 'Replaced with the current auxiliary model id.', signatureLabel: 'axmodel' },
  { name: 'role', description: 'Replaced with the current role of the message sender.', signatureLabel: 'role' },
  { name: 'maxcontext', description: 'Replaced with the maximum context tokens setting.', signatureLabel: 'maxcontext' },
  { name: 'lastmessage', description: 'Replaced with the last message in the chat log.', signatureLabel: 'lastmessage' },
  { name: 'lastmessageid', aliases: ['lastmessageindex'], description: 'Replaced with the index of the last message.', signatureLabel: 'lastmessageid' },
  { name: 'previous_char_chat', aliases: ['lastcharmessage', 'previouscharchat'], description: "Replaced with the last message of the current character.", signatureLabel: 'previous_char_chat' },
  { name: 'previous_user_chat', aliases: ['lastusermessage', 'previoususerchat'], description: "Replaced with the last message of the user.", signatureLabel: 'previous_user_chat' },
  { name: 'previous_chat_log', description: 'Replaced with the chat message with the index A.', signatureLabel: 'previous_chat_log::A', parameters: [{ label: 'A (index)' }] },
  { name: 'first_msg_index', aliases: ['firstmessageindex', 'firstmsgindex'], description: 'Replaced with the index of the first message.', signatureLabel: 'first_msg_index' },
  { name: 'screen_width', aliases: ['screenwidth'], description: 'Replaced with the width of the screen in pixels.', signatureLabel: 'screen_width' },
  { name: 'screen_height', aliases: ['screenheight'], description: 'Replaced with the height of the screen in pixels.', signatureLabel: 'screen_height' },
  { name: 'user_history', aliases: ['user_messages', 'userhistory', 'usermessages'], description: 'Replaced with the array of messages of the user.', signatureLabel: 'user_history' },
  { name: 'char_history', aliases: ['char_messages', 'charhistory', 'charmessages'], description: 'Replaced with the array of messages of the character.', signatureLabel: 'char_history' },
  { name: 'scenario', description: "Replaced with the character's scenario.", signatureLabel: 'scenario' },
  { name: 'main_prompt', aliases: ['system_prompt', 'systemprompt', 'mainprompt'], description: 'Replaced with the main/system prompt.', signatureLabel: 'main_prompt' },
  { name: 'jailbreak', aliases: ['jb'], description: 'Replaced with the jailbreak prompt.', signatureLabel: 'jailbreak' },
  { name: 'global_note', aliases: ['ujb', 'system_note', 'globalnote', 'systemnote'], description: 'Replaced with the user jailbreak/global note.', signatureLabel: 'global_note' },

  // Time Syntaxes
  { name: 'time', description: 'Replaced with the current time (HH:MM:SS).', signatureLabel: 'time' },
  { name: 'date', description: 'Replaced with the current date (YYYY-MM-DD).', signatureLabel: 'date' },
  { name: 'datetimeformat', aliases: ['date_time_format'], description: 'Replaced with the current date/time formatted by A, optionally using timestamp B.', signatureLabel: 'datetimeformat::A::[B]', parameters: [{ label: 'A (format string)' }, { label: 'B (timestamp)', documentation: 'Optional Unix timestamp in ms.' }] },
  { name: 'isotime', description: 'Replaced with the current time in UTC (HH:MM:SS).', signatureLabel: 'isotime' },
  { name: 'isodate', description: 'Replaced with the current date in UTC (YYYY-MM-DD).', signatureLabel: 'isodate' },
  { name: 'message_time', aliases: ['messagetime'], description: 'Replaced with the time when the message was sent.', signatureLabel: 'message_time' },
  { name: 'message_date', aliases: ['messagedate'], description: 'Replaced with the date when the message was sent.', signatureLabel: 'message_date' },
  { name: 'message_idle_duration', aliases: ['messageidleduration'], description: 'Replaced with the idle duration between user messages.', signatureLabel: 'message_idle_duration' },
  { name: 'idle_duration', aliases: ['idleduration'], description: 'Replaced with the idle duration since the last user message.', signatureLabel: 'idle_duration' },
  { name: 'message_unixtime_array', aliases: ['messageunixtimearray'], description: 'Replaced with the array of unix timestamps (ms) of the chat log.', signatureLabel: 'message_unixtime_array' },
  { name: 'unixtime', description: 'Replaced with the current Unix timestamp (seconds).', signatureLabel: 'unixtime' },

  // Emotion/Asset Syntaxes
  { name: 'asset', description: 'Replaced with the asset element named A (image or video).', signatureLabel: 'asset::A', parameters: [{ label: 'A (asset name)' }] },
  { name: 'emotion', description: 'Replaced with the emotion image element named A.', signatureLabel: 'emotion::A', parameters: [{ label: 'A (emotion name)' }] },
  { name: 'audio', description: 'Replaced with the audio element named A.', signatureLabel: 'audio::A', parameters: [{ label: 'A (asset name)' }] },
  { name: 'bg', description: 'Replaced with the background image element named A.', signatureLabel: 'bg::A', parameters: [{ label: 'A (asset name)' }] },
  { name: 'video', description: 'Replaced with the video element named A.', signatureLabel: 'video::A', parameters: [{ label: 'A (asset name)' }] },
  { name: 'video-img', description: 'Replaced with the video element displayed as image named A.', signatureLabel: 'video-img::A', parameters: [{ label: 'A (asset name)' }] },
  { name: 'raw', description: 'Replaced with the raw asset path data named A.', signatureLabel: 'raw::A', parameters: [{ label: 'A (asset name)' }] },
  { name: 'image', description: 'Replaced with the image element named A.', signatureLabel: 'image::A', parameters: [{ label: 'A (asset name)' }] },
  { name: 'img', description: 'Replaced with the unstyled image element named A.', signatureLabel: 'img::A', parameters: [{ label: 'A (asset name)' }] },
  { name: 'path', description: 'Replaced with the raw asset path data named A (alias for raw).', signatureLabel: 'path::A', parameters: [{ label: 'A (asset name)' }] },
  { name: 'bgm', description: 'Inserts a hidden element to play background music asset A.', signatureLabel: 'bgm::A', parameters: [{ label: 'A (asset name)' }] },
  { name: 'inlay', description: 'Replaced with the inlay asset element named A.', signatureLabel: 'inlay::A', parameters: [{ label: 'A (inlay ID)' }] },
  { name: 'inlayed', description: 'Replaced with the inlay asset element named A, wrapped in a div.', signatureLabel: 'inlayed::A', parameters: [{ label: 'A (inlay ID)' }] },
  { name: 'inlayeddata', description: 'Replaced with the inlay asset element named A, wrapped in a div (alias for inlayed).', signatureLabel: 'inlayeddata::A', parameters: [{ label: 'A (inlay ID)' }] },
  { name: 'assetlist', description: 'Replaced with the array of names of additional assets.', signatureLabel: 'assetlist' },
  { name: 'emotionlist', description: 'Replaced with the array of names of emotion images.', signatureLabel: 'emotionlist' },
  { name: 'source', description: 'Replaced with the path of the icon (char or user).', signatureLabel: 'source::A', parameters: [{ label: 'A ("char" or "user")' }] },
  { name: 'module_assetlist', aliases: ['moduleassetlist'], description: 'Replaced with the array of asset names for module A.', signatureLabel: 'module_assetlist::A', parameters: [{ label: 'A (module namespace)' }] },

  // Math Syntaxes
  { name: '?', aliases: ['calc'], description: 'Replaced with the result of the calculation A.', signatureLabel: '? A', parameters: [{ label: 'A (expression)' }], isPrefixCommand: true },
  { name: 'equal', description: 'Returns 1 if A equals B, else 0.', signatureLabel: 'equal::A::B', parameters: [{ label: 'A' }, { label: 'B' }] },
  { name: 'not_equal', aliases: ['notequal'], description: 'Returns 1 if A is not equal to B, else 0.', signatureLabel: 'not_equal::A::B', parameters: [{ label: 'A' }, { label: 'B' }] },
  { name: 'remaind', description: 'Replaced with the remainder of A divided by B.', signatureLabel: 'remaind::A::B', parameters: [{ label: 'A' }, { label: 'B' }] },
  { name: 'greater', description: 'Returns 1 if A > B, else 0.', signatureLabel: 'greater::A::B', parameters: [{ label: 'A' }, { label: 'B' }] },
  { name: 'greater_equal', aliases: ['greaterequal'], description: 'Returns 1 if A >= B, else 0.', signatureLabel: 'greater_equal::A::B', parameters: [{ label: 'A' }, { label: 'B' }] },
  { name: 'less', description: 'Returns 1 if A < B, else 0.', signatureLabel: 'less::A::B', parameters: [{ label: 'A' }, { label: 'B' }] },
  { name: 'less_equal', aliases: ['lessequal'], description: 'Returns 1 if A <= B, else 0.', signatureLabel: 'less_equal::A::B', parameters: [{ label: 'A' }, { label: 'B' }] },
  { name: 'and', description: 'Returns 1 if A and B are 1, else 0.', signatureLabel: 'and::A::B', parameters: [{ label: 'A' }, { label: 'B' }] },
  { name: 'or', description: 'Returns 1 if A or B is 1, else 0.', signatureLabel: 'or::A::B', parameters: [{ label: 'A' }, { label: 'B' }] },
  { name: 'pow', description: 'Replaced with A raised to the power of B.', signatureLabel: 'pow::A::B', parameters: [{ label: 'A (base)' }, { label: 'B (exponent)' }] },
  { name: 'not', description: 'Returns 1 if A is 0, else 0.', signatureLabel: 'not::A', parameters: [{ label: 'A' }] },
  { name: 'floor', description: 'Replaced with the largest integer <= A.', signatureLabel: 'floor::A', parameters: [{ label: 'A' }] },
  { name: 'ceil', description: 'Replaced with the smallest integer >= A.', signatureLabel: 'ceil::A', parameters: [{ label: 'A' }] },
  { name: 'abs', description: 'Replaced with the absolute value of A.', signatureLabel: 'abs::A', parameters: [{ label: 'A' }] },
  { name: 'round', description: 'Replaced with A rounded to the nearest integer.', signatureLabel: 'round::A', parameters: [{ label: 'A' }] },
  { name: 'min', description: 'Replaced with the smallest value among parameters (can take multiple args or a single array).', signatureLabel: 'min::A::[B...]', parameters: [{ label: 'A (value or array)' }, { label: 'B... (optional values)' }] },
  { name: 'max', description: 'Replaced with the largest value among parameters (can take multiple args or a single array).', signatureLabel: 'max::A::[B...]', parameters: [{ label: 'A (value or array)' }, { label: 'B... (optional values)' }] },
  { name: 'sum', description: 'Replaced with the sum of parameters (can take multiple args or a single array).', signatureLabel: 'sum::A::[B...]', parameters: [{ label: 'A (value or array)' }, { label: 'B... (optional values)' }] },
  { name: 'average', description: 'Replaced with the average of parameters (can take multiple args or a single array).', signatureLabel: 'average::A::[B...]', parameters: [{ label: 'A (value or array)' }, { label: 'B... (optional values)' }] },
  { name: 'fix_number', aliases: ['fixnum', 'fix_num', 'fixnumber'], description: 'Replaced with A fixed to B decimal places.', signatureLabel: 'fix_number::A::B', parameters: [{ label: 'A (number)' }, { label: 'B (decimal places)' }] },
  { name: 'hash', description: 'Replaced with a consistent hash-based number derived from string A.', signatureLabel: 'hash::A', parameters: [{ label: 'A (string)' }] },
  { name: 'randint', description: 'Replaced with a random integer between A (min) and B (max), inclusive.', signatureLabel: 'randint::A::B', parameters: [{ label: 'A (min)' }, { label: 'B (max)' }] },
  { name: 'dice', description: 'Replaced with the result of a dice roll, e.g., 2d6.', signatureLabel: 'dice::A', parameters: [{ label: 'A (dice notation like XdY)' }] },
  { name: 'fromhex', description: 'Converts hexadecimal string A to its decimal number representation.', signatureLabel: 'fromhex::A', parameters: [{ label: 'A (hexadecimal string)' }] },
  { name: 'tohex', description: 'Converts number A to its hexadecimal string representation.', signatureLabel: 'tohex::A', parameters: [{ label: 'A (number)' }] },

  // String Syntaxes
  { name: 'startswith', description: 'Returns 1 if A starts with B, else 0.', signatureLabel: 'startswith::A::B', parameters: [{ label: 'A (string)' }, { label: 'B (prefix)' }] },
  { name: 'endswith', description: 'Returns 1 if A ends with B, else 0.', signatureLabel: 'endswith::A::B', parameters: [{ label: 'A (string)' }, { label: 'B (suffix)' }] },
  { name: 'contains', description: 'Returns 1 if A contains B, else 0.', signatureLabel: 'contains::A::B', parameters: [{ label: 'A (string)' }, { label: 'B (substring)' }] },
  { name: 'lower', description: 'Replaced with A converted to lowercase.', signatureLabel: 'lower::A', parameters: [{ label: 'A (string)' }] },
  { name: 'upper', description: 'Replaced with A converted to uppercase.', signatureLabel: 'upper::A', parameters: [{ label: 'A (string)' }] },
  { name: 'capitalize', description: 'Replaced with A with the first letter capitalized.', signatureLabel: 'capitalize::A', parameters: [{ label: 'A (string)' }] },
  { name: 'trim', description: 'Replaced with A with leading/trailing whitespace removed.', signatureLabel: 'trim::A', parameters: [{ label: 'A (string)' }] },
  { name: 'unicode_encode', aliases: ['unicodeencode'], description: 'Replaced with A encoded to unicode number.', signatureLabel: 'unicode_encode::A::[B]', parameters: [{ label: 'A (string)' }, { label: 'B (index, optional)', documentation:'Defaults to 0'}] },
  { name: 'unicode_decode', aliases: ['unicodedecode'], description: 'Replaced with A decoded from unicode number.', signatureLabel: 'unicode_decode::A', parameters: [{ label: 'A (number)' }] },
  { name: 'u', aliases: ['unicodedecodefromhex'], description: 'Replaced with character decoded from hexadecimal unicode value A.', signatureLabel: 'u::A', parameters: [{ label: 'A (hexadecimal unicode value)' }] },
  { name: 'ue', aliases: ['unicodeencodefromhex'], description: 'Replaced with character decoded from hexadecimal unicode value A. (Note: Parser implements this as decode, similar to `u`)', signatureLabel: 'ue::A', parameters: [{ label: 'A (hexadecimal unicode value)' }] },

  // Conditional Syntaxes
  { name: 'prefill_supported', aliases: ['prefillsupported', 'prefill'], description: 'Returns 1 if the model supports prefilling (e.g. Claude), else 0.', signatureLabel: 'prefill_supported' },
  { name: 'jbtoggled', description: 'Returns 1 if jailbreak is enabled, else 0.', signatureLabel: 'jbtoggled' },
  { name: 'isfirstmsg', aliases: ['is_first_msg', 'is_first_message', 'isfirstmessage'], description: 'Returns 1 if the message is the first message, else 0.', signatureLabel: 'isfirstmsg' },
  { name: 'all', description: 'Returns 1 if all parameters are 1, else 0 (can take multiple args or a single array).', signatureLabel: 'all::A::[B...]', parameters: [{ label: 'A (value or array)' }, { label: 'B... (optional values)' }] },
  { name: 'any', description: 'Returns 1 if any parameter is 1, else 0 (can take multiple args or a single array).', signatureLabel: 'any::A::[B...]', parameters: [{ label: 'A (value or array)' }, { label: 'B... (optional values)' }] },
  { name: 'module_enabled', aliases: ['moduleenabled'], description: 'Returns 1 if module A is enabled, else 0.', signatureLabel: 'module_enabled::A', parameters: [{ label: 'A (module namespace)' }] },
  { name: 'iserror', description: 'Returns 1 if string A starts with "error:" (case-insensitive), else 0.', signatureLabel: 'iserror::A', parameters: [{ label: 'A (string)' }] },

  // Variable Syntaxes
  { name: 'getvar', description: 'Replaced with the value of chat variable A.', signatureLabel: 'getvar::A', parameters: [{ label: 'A (variable name)' }] },
  { name: 'setvar', description: 'Sets chat variable A to B.', signatureLabel: 'setvar::A::B', parameters: [{ label: 'A (variable name)' }, { label: 'B (value)' }] },
  { name: 'addvar', description: 'Increments chat variable A by B.', signatureLabel: 'addvar::A::B', parameters: [{ label: 'A (variable name)' }, { label: 'B (increment value)' }] },
  { name: 'settempvar', description: 'Sets temporary variable A to B.', signatureLabel: 'settempvar::A::B', parameters: [{ label: 'A (variable name)' }, { label: 'B (value)' }] },
  { name: 'gettempvar', aliases: ['tempvar'], description: 'Replaced with the value of temporary variable A.', signatureLabel: 'gettempvar::A', parameters: [{ label: 'A (variable name)' }] },
  { name: 'getglobalvar', description: 'Replaced with the value of global variable A.', signatureLabel: 'getglobalvar::A', parameters: [{ label: 'A (variable name)' }] },
  { name: 'setdefaultvar', description: 'Sets chat variable A to B only if A does not exist.', signatureLabel: 'setdefaultvar::A::B', parameters: [{ label: 'A (variable name)' }, { label: 'B (value)' }] },

  // Array Syntaxes
  { name: 'array', aliases: ['makearray', 'a', 'make_array'], description: 'Creates an array from parameters.', signatureLabel: 'array::A::[B...]', parameters: [{ label: 'A (element)' }, { label: 'B... (optional elements)' }] },
  { name: 'array_length', aliases: ['arraylength'], description: 'Replaced with the length of array A.', signatureLabel: 'array_length::A', parameters: [{ label: 'A (array)' }] },
  { name: 'array_element', aliases: ['arrayelement'], description: 'Replaced with the element of array A at index B.', signatureLabel: 'array_element::A::B', parameters: [{ label: 'A (array)' }, { label: 'B (index)' }] },
  { name: 'array_push', aliases: ['arraypush'], description: 'Replaced with array A with element B pushed.', signatureLabel: 'array_push::A::B', parameters: [{ label: 'A (array)' }, { label: 'B (element)' }] },
  { name: 'array_pop', aliases: ['arraypop'], description: 'Replaced with array A with the last element removed.', signatureLabel: 'array_pop::A', parameters: [{ label: 'A (array)' }] },
  { name: 'array_shift', aliases: ['arrayshift'], description: 'Replaced with array A with the first element removed.', signatureLabel: 'array_shift::A', parameters: [{ label: 'A (array)' }] },
  { name: 'array_splice', aliases: ['arraysplice'], description: 'Replaced with array A with elements D... inserted/deleted at index B for C count.', signatureLabel: 'array_splice::A::B::C::[D...]', parameters: [{ label: 'A (array)' }, { label: 'B (index)' }, { label: 'C (delete count)' }, { label: 'D... (elements to insert)' }] },
  { name: 'array_assert', aliases: ['arrayassert'], description: 'Replaced with array A with element C inserted at index B.', signatureLabel: 'array_assert::A::B::C', parameters: [{ label: 'A (array)' }, { label: 'B (index)' }, { label: 'C (element)' }] },
  { name: 'split', description: 'Splits string A by separator B into an array.', signatureLabel: 'split::A::B', parameters: [{ label: 'A (string)' }, { label: 'B (separator)' }] },
  { name: 'join', description: 'Joins array A with separator B into a string.', signatureLabel: 'join::A::B', parameters: [{ label: 'A (array)' }, { label: 'B (separator)' }] },
  { name: 'filter', description: 'Filters array A based on option B.', signatureLabel: 'filter::A::B', parameters: [{ label: 'A (array)' }, { label: 'B (option: nonempty, unique, all)' }] },

  // Dictionary Syntaxes
  { name: 'dict', aliases: ['object', 'o', 'd', 'makedict', 'make_dict', 'makeobject', 'make_object'], description: 'Creates a dictionary.', signatureLabel: 'dict::key1=value1::[key2=value2...]', parameters: [{ label: 'key=value pairs' }] },
  { name: 'dict_element', aliases: ['object_element', 'dictelement', 'objectelement'], description: 'Replaced with the value of key B in dictionary A.', signatureLabel: 'dict_element::A::B', parameters: [{ label: 'A (dictionary)' }, { label: 'B (key)' }] },
  { name: 'dict_assert', aliases: ['object_assert', 'dictassert', 'objectassert'], description: 'Replaced with dictionary A with key B and value C inserted.', signatureLabel: 'dict_assert::A::B::C', parameters: [{ label: 'A (dictionary)' }, { label: 'B (key)' }, { label: 'C (value)' }] },
  { name: 'element', aliases: ['ele'], description: 'Access nested element in JSON object/array A using path B, C...', signatureLabel: 'element::A::B::[C...]', parameters: [{ label: 'A (JSON object/array)' }, { label: 'B (key/index)' }, { label: 'C... (nested keys/indices)' }] },

  // Utility Syntaxes
  { name: 'slot', description: "If used in prompt template, pipeline or translator prompt ({{slot}}), it will be replaced to original slot content. Otherwise, it will not be replaced.", signatureLabel: 'slot' },
  { name: 'slot', description: 'Used within #each blocks ({{slot::A}}). Replaced with the current element being iterated over, identified by name A.', signatureLabel: 'slot::A', parameters: [{ label: 'A (item variable name from #each)' }] },
  { name: 'position', description: 'Replaced with lorebook content at position pt_A.', signatureLabel: 'position::A', parameters: [{ label: 'A (position name)' }] },
  { name: 'random', description: "Replaced with a pseudo-random floating-point number (0-1).", signatureLabel: 'random' },
  { name: 'random', description: 'Replaced with a random value from parameters. Can use :: or : with , as separator (e.g., random::A::B or random:A,B).', signatureLabel: 'random:A,[B...]', parameters: [{ label: 'A, B... (values)' }], isPrefixCommand: true }, // Note: isPrefixCommand here refers to the colon format, not a general prefix.
  { name: 'pick', description: 'Consistent random value from parameters for the same message. Can use :: or : with , as separator.', signatureLabel: 'pick:A,[B...]', parameters: [{ label: 'A, B... (values)' }], isPrefixCommand: true }, // Note: isPrefixCommand here refers to the colon format.
  { name: 'roll', description: 'Random number between 1 and A (e.g., roll:6 or roll:d20).', signatureLabel: 'roll:A', parameters: [{ label: 'A (max value or dX)' }], isPrefixCommand: true },
  { name: 'rollp', description: 'Consistent random number between 1 and A for the same message (e.g., rollp:6 or rollp:d20).', signatureLabel: 'rollp:A', parameters: [{ label: 'A (max value or dX)' }], isPrefixCommand: true },
  { name: 'spread', description: 'Joins array A with :: for use in other syntaxes.', signatureLabel: 'spread::A', parameters: [{ label: 'A (array)' }] },
  { name: 'replace', description: 'Replaced with A with all B replaced by C.', signatureLabel: 'replace::A::B::C', parameters: [{ label: 'A (text)' }, { label: 'B (search)' }, { label: 'C (replace)' }] },
  { name: 'range', description: 'Creates an array of numbers from array A. A can be [count], [start, end], or [start, end, step].', signatureLabel: 'range::A', parameters: [{ label: 'A (array: [count] or [start, end, step?])' }] },
  { name: 'length', description: 'Replaced with the length of string A.', signatureLabel: 'length::A', parameters: [{ label: 'A (string)' }] },
  { name: 'none', aliases: ['blank'], description: 'Replaced with an empty string.', signatureLabel: 'none' },
  { name: 'br', aliases: ['newline'], description: 'Replaced with a line break character (`\\n`).', signatureLabel: 'br' },
  { name: 'cbr', aliases: ['cnl', 'cnewline'], description: "Replaced with an escaped newline string `\\\\n`. If A is provided, repeats `\\\\n` A times.", signatureLabel: 'cbr::[A]', parameters: [{ label: 'A (count, optional)' }] },
  { name: 'tonumber', description: 'Trims non-numeric characters from A.', signatureLabel: 'tonumber::A', parameters: [{ label: 'A (string)' }] },
  { name: 'return', description: 'Halts processing for the current CBS scope and returns value A.', signatureLabel: 'return::A', parameters: [{ label: 'A (value)' }] },
  { name: 'arg', description: 'Used within #func blocks. Replaced with argument at index A.', signatureLabel: 'arg::A', parameters: [{ label: 'A (argument index)' }] },
  { name: 'button', description: 'Creates a button with label A triggering action B.', signatureLabel: 'button::A::B', parameters: [{ label: 'A (label)' }, { label: 'B (trigger action)' }] },
  { name: 'risu', description: 'Displays the RisuAI logo with optional size A.', signatureLabel: 'risu::[A]', parameters: [{ label: 'A (size in px, optional)' }] },
  { name: 'file', description: 'Used internally for file attachments. Displays filename A, contains base64 data B.', signatureLabel: 'file::A::B', parameters: [{ label: 'A (filename)' }, { label: 'B (base64 data)' }] },
  { name: 'calc', description: 'Replaced with the result of the calculation A (double-colon syntax).', signatureLabel: 'calc::A', parameters: [{ label: 'A (expression)' }] },
  { name: 'metadata', description: 'Accesses various application or environment metadata via key A. Subkeys (B) may be used for some main keys (e.g., `languagekey`). Known keys: `mobile`, `local`, `node`, `version`, `majorversion`/`majorver`/`major`, `language`/`locale`/`lang`, `browserlanguage`/`browserlocale`/`browserlang`, `languagekey::B`, `modelshortname`, `modelname`, `modelinternalid`, `modelformat`, `modelprovider`, `modeltokenizer`, `imateapot`, `risutype`, `maxcontext`.', signatureLabel: 'metadata::A::[B]', parameters: [{ label: 'A (metadata key)' }, {label: 'B (subkey, optional)'}] },

  // Display Escape Syntaxes (New)
  { name: 'decbo', aliases: ['displayescapedcurlybracketopen'], description: "Replaced with a placeholder (`\\uE9b8`) that renders as '{', preventing CBS parsing of the brace.", signatureLabel: 'decbo' },
  { name: 'decbc', aliases: ['displayescapedcurlybracketclose'], description: "Replaced with a placeholder (`\\uE9b9`) that renders as '}', preventing CBS parsing of the brace.", signatureLabel: 'decbc' },
  { name: 'bo', aliases: ['ddecbo', 'doubledisplayescapedcurlybracketopen'], description: "Replaced with placeholders (`\\uE9b8\\uE9b8`) that render as '{{', preventing CBS parsing.", signatureLabel: 'bo' },
  { name: 'bc', aliases: ['ddecbc', 'doubledisplayescapedcurlybracketclose'], description: "Replaced with placeholders (`\\uE9b9\\uE9b9`) that render as '}}', preventing CBS parsing.", signatureLabel: 'bc' },
  { name: 'debo', aliases: ['displayescapedbracketopen', '('], description: "Replaced with a placeholder (`\\uE9BA`) that renders as '(', preventing CBS parsing.", signatureLabel: 'debo' },
  { name: 'debc', aliases: ['displayescapedbracketclose', ')'], description: "Replaced with a placeholder (`\\uE9BB`) that renders as ')', preventing CBS parsing.", signatureLabel: 'debc' },
  { name: 'deabo', aliases: ['displayescapedanglebracketopen', '<'], description: "Replaced with a placeholder (`\\uE9BC`) that renders as '<' (via <), preventing CBS parsing.", signatureLabel: 'deabo' },
  { name: 'deabc', aliases: ['displayescapedanglebracketclose', '>'], description: "Replaced with a placeholder (`\\uE9BD`) that renders as '>' (via >), preventing CBS parsing.", signatureLabel: 'deabc' },
  { name: 'dec', aliases: ['displayescapedcolon', ':'], description: "Replaced with a placeholder (`\\uE9BE`) that renders as ':', preventing CBS parsing.", signatureLabel: 'dec' },
  { name: 'displayescapedsemicolon', aliases: [';'], description: "Replaced with a placeholder (`\\uE9BF`) that renders as ';', preventing CBS parsing.", signatureLabel: 'displayescapedsemicolon' },

  // Prefix Syntaxes (Use ':' separator)
  { name: 'reverse', description: 'Reverses the string A.', signatureLabel: 'reverse:A', parameters: [{ label: 'A (string)' }], isPrefixCommand: true },
  { name: 'comment', description: 'A comment block, ignored unless displaying.', signatureLabel: 'comment:A', parameters: [{ label: 'A (comment text)' }], isPrefixCommand: true },
  { name: 'hidden_key', description: 'Internal key, ignored by the parser.', signatureLabel: 'hidden_key:A', parameters: [{ label: 'A (key text)' }], isPrefixCommand: true },
  { name: 'datetimeformat', description: 'Replaced with the current date/time formatted by A (prefix syntax).', signatureLabel: 'datetimeformat:A', parameters: [{ label: 'A (format string)' }], isPrefixCommand: true }, // Prefix version of datetimeformat

  // Function/Block Calling
  { name: 'call', description: 'Calls a previously defined #func block A with arguments B, C...', signatureLabel: 'call::A::[B...]', parameters: [{ label: 'A (function name)' }, { label: 'B... (arguments)' }] },


  // For various reasons, the commented-out CBS commands are listed below. They are not actually used but are kept in the code.

  // Internal Commands Skip because they are not meant for general use
//   { name: '__assistantprompt', description: 'Internal command. Behavior may vary (e.g., returns Airisu prompt for `__airisu` character). Not for general use.', signatureLabel: '__assistantprompt', isInternal: true },

  // Block Syntaxes Skip because they are handled with snippets in extension.ts
//   { name: '#if', description: 'Conditional block. Content is processed if condition is true (1).', signatureLabel: '#if condition', parameters: [{ label: 'condition' }], isBlock: true },
//   { name: '#if_pure', description: 'Conditional block preserving whitespace. Content is processed if condition is true (1).', signatureLabel: '#if_pure condition', parameters: [{ label: 'condition' }], isBlock: true },
//   { name: '#each', description: 'Loop block over an array.', signatureLabel: '#each array [as item]', parameters: [{ label: 'array' }, { label: 'item (variable name, optional)' }], isBlock: true },
//   { name: '#func', description: 'Defines a function block.', signatureLabel: '#func functionName [arg1] [arg2]...', parameters: [{ label: 'functionName' }, { label: 'arg... (optional argument names)' }], isBlock: true },
//   { name: '#pure_display', aliases: ['#puredisplay'], description: 'Displays content without formatting or CBS parsing, but replaces `{{` and `}}` with escaped versions.', signatureLabel: '#pure_display', isBlock: true },
//   { name: '#pure', description: 'Preserves whitespace and prevents CBS parsing within the block.', signatureLabel: '#pure', isBlock: true },
//   { name: '#code', description: 'Content within this block is normalized: leading/trailing whitespace trimmed per line, then overall trim. Escape sequences (e.g., \\n, \\uXXXX) are converted to their respective characters.', signatureLabel: '#code', isBlock: true },
];

// Helper function to find command info by name (including prefix like #) or alias
export function findCommandInfo(commandIdentifier: string): CbsCommandInfo | undefined {
    const lowerCommandIdentifier = commandIdentifier.toLowerCase();
    return cbsCommandsData.find(cmd => {
        // Check primary name (case-insensitive)
        if (cmd.name.toLowerCase() === lowerCommandIdentifier) {
            return true;
        }
        // Check aliases (case-insensitive) only if the identifier doesn't start with #, ?, /
        // and the command itself is not a prefix command (to avoid matching 'random' for 'random:A')
        if (!/^[#?\/]/.test(lowerCommandIdentifier) && !cmd.isPrefixCommand && cmd.aliases) {
           return cmd.aliases.some(alias => alias.toLowerCase() === lowerCommandIdentifier);
        }
        // For prefix commands, check if the identifier starts with the command name + ':'
        if (cmd.isPrefixCommand && lowerCommandIdentifier.startsWith(cmd.name.toLowerCase() + ':')) {
            return true;
        }
    return false;
  });
}

// Helper function to find ALL command info entries by name or alias
// This is useful when a command name can have multiple signatures (e.g. 'random' simple vs 'random:A,B')
export function findAllCommandInfo(commandIdentifier: string): CbsCommandInfo[] {
    const lowerCommandIdentifier = commandIdentifier.toLowerCase();
    return cbsCommandsData.filter(cmd => {
        if (cmd.name.toLowerCase() === lowerCommandIdentifier) {
            return true;
        }
        if (!cmd.isPrefixCommand && cmd.aliases?.some(alias => alias.toLowerCase() === lowerCommandIdentifier)) {
           return true;
        }
        // This part might be tricky if a prefix command name without the colon matches a non-prefix command.
        // For now, keeping it simple. If 'random' is searched, it should find both 'random' and 'random:A,B'.
        if (cmd.isPrefixCommand && lowerCommandIdentifier === cmd.name.toLowerCase()){
            return true;
        }
        return false;
    });
}

// Helper function to get command identifier (prefix + name) from text preceding the cursor
// e.g., finds '#if' in '{{#if cond::' or 'replace' in '{{replace::text'
// For prefix commands like 'reverse:A', it should identify 'reverse' if after '{{reverse:'
export function extractCommandIdentifierFromPrefix(textBeforeCursor: string): string | null {
    // Match for {{#command}}, {{?command}}, {{/command}}, {{command}}
    let match = textBeforeCursor.match(/\{\{(?:(#|\?|\/)\s*)?([\w-]+)/i);
    if (match) {
        const prefix = match[1] || '';
        const name = match[2];
        if (prefix === '?') return '?'; // Special case for calc
        return prefix + name;
    }

    // Match for prefix commands like {{reverse:
    match = textBeforeCursor.match(/\{\{([\w-]+):/i);
    if (match) {
        // Check if this is a known prefix command to avoid false positives
        const potentialCmd = match[1];
        if (cbsCommandsData.some(cmd => cmd.name === potentialCmd && cmd.isPrefixCommand)) {
            return potentialCmd;
        }
    }
    return null;
}


// Helper function to count parameters based on '::' within the current CBS tag context
// Starts counting after the command identifier is found
export function countParametersInCurrentTag(textBeforeCursor: string): number {
    // Find the start of the current command tag, including potential prefix commands
    const tagStartMatch = textBeforeCursor.match(/\{\{(?:#|\?|\/)?\s*[\w-]+(?:[:]{1}(?![:]))?/i); // Added : for prefix commands, but not ::
    if (!tagStartMatch || tagStartMatch.index === undefined) {
        return 0;
    }
    // Get the text *after* the command name (and optional single colon for prefix commands) within the current tag
    const textAfterCommand = textBeforeCursor.substring(tagStartMatch.index + tagStartMatch[0].length);

    // Count '::' occurrences in that specific part
    const matches = textAfterCommand.match(/::/g);
    return matches ? matches.length : 0;
}