

"""
Okay, the format we want is probably a hash lookup, for speed

{
    'lookup key': 'filename'
}

do we support partial lookups?  and/or, how?
1: look for full phrase, fails, look for each word?
How do we deal with l'e?

"""

import json

all_items = {}
this_item = None

with open('index.tags.txt') as f:
    
    line_tag = None
    line_start = None
    
    for i, line in enumerate(f):

        line = line.strip()
        
        if line.startswith('['):
            line_tag = line.strip().replace('[', '').replace(']', '')
            line_start = True
            # print line_tag
        else:
            line_start = False


        if line_tag is None or line_tag == 'GLOBAL' or line_start:
            continue

        # print i, line

        if 'SWAC_TEXT' in line:
            # print 'setting text'
            this_item = line.split('=')[-1]

        if 'SWAC_ALPHAIDX' in line:
            indexthing = line.split('=')[-1]
            # print indexthing, type(indexthing)
            all_items[indexthing] = {'SWAC_TEXT': this_item, 'filename': line_tag}
            # print {t: type(t) for t in all_items}

        if 'SWAC_TECH_QLT' in line:
            all_items[indexthing]['QUALITY'] = line.split('=')[-1]


        # if i > 50:
            # print json.dumps(all_items, indent=2, ensure_ascii=False)
            # print all_items.keys()[0]
            # break


with open('tag_index.json', 'w') as f:
    json.dump(all_items, f, ensure_ascii=False)
























