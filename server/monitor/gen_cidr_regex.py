import sys
from math import log10

def gen_pattern(lower, upper, exp, delta):
    floor = lambda x: int(round(x // delta, 0) * delta)
    xs = range(floor(upper) - delta, floor(lower), -delta)
    for x in map(str, xs):
        # ES regexp not works well with '\d', just use '[0-9]'
        yield '%s%s' % (x[:-exp], '[0-9]' * exp)

    yield regex(lower, floor(lower) + (delta - 1))
    yield regex(floor(upper), upper)

def regex(lower, upper):
    if lower == upper:
        return str(lower)

    exp = int(log10(upper - lower))
    if (int(str(lower)[-1]) > int(str(upper)[-1]) and exp == 0):
        exp += 1
    delta = 10 ** exp

    if lower == 0 and upper == 255:
        return "[0-9]+"

    if delta == 1:
        val = ""
        for a, b in zip(str(lower), str(upper)):
            if a == b:
                val += str(a)
            elif (a, b) == ("0", "9"):
                val += '[0-9]'
            elif int(b) - int(a) == 1:
                val += '[%s%s]' % (a, b)
            else:
                val += '[%s-%s]' % (a, b)
        return val
    return "(%s)" % ('|'.join(gen_pattern(lower=lower, upper=upper, exp=exp, delta=delta)))

def get_parts(start, end):
    for x in range(24, -1, -8):
        yield regex(start >> x & 255, end >> x & 255)

def cidr_to_regex(cidr):
    ip, prefix = cidr.split('/')

    base = 0
    for val in map(int, ip.split('.')):
        base = (base << 8) | val

    shift = 32 - int(prefix)
    start = base >> shift << shift
    end = start | (1 << shift) - 1  # rm broadcast_address

    return '.'.join(get_parts(start, end))

'''
if __name__ == '__main__':
    #for line in sys.stdin.readlines():
    #    cidr_to_regex(line)
    print(cidr_to_regex(sys.argv[1]))
'''
